import {PDFDocument} from "pdf-lib";
import type {ParsedPdfPage, PreparedPdfPage, UnstructuredWrapperOptions} from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "STOPPED" | "FAILED";

interface JobResponse {
    id: string;
    status: JobStatus;
    output_node_files?: Array<{
        node_id?: string;
        file_id: string;
        node_type?: string;
    }> | null;
}

export class UnstructuredApiError extends Error {
    constructor(
        readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = "UnstructuredApiError";
    }
}

export class UnstructuredWrapper {
    private readonly apiKey: string;
    private readonly apiUrl: string;
    private readonly fetcher: typeof fetch;
    private readonly pollIntervalMs: number;
    private readonly timeoutMs: number;

    constructor(options: UnstructuredWrapperOptions) {
        this.apiKey = options.apiKey.trim();
        this.apiUrl = UnstructuredWrapper.normalizeApiUrl(options.apiUrl);
        this.fetcher = options.fetcher ?? fetch;
        this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    async splitPdfPages(
        pdfBytes: Uint8Array,
        startPage: number,
        endPage: number,
        sourceFileName: string
    ): Promise<PreparedPdfPage[]> {
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pageCount = sourcePdf.getPageCount();
        if (startPage < 1 || endPage < startPage || endPage > pageCount) {
            throw new Error(
                `PDF page range ${startPage}-${endPage} is invalid for a document with ${pageCount} pages.`
            );
        }

        const fileStem = sourceFileName.replace(/\.pdf$/i, "") || "document";
        const pages: PreparedPdfPage[] = [];
        for (let pageNo = startPage; pageNo <= endPage; pageNo++) {
            const pagePdf = await PDFDocument.create();
            const [page] = await pagePdf.copyPages(sourcePdf, [pageNo - 1]);
            pagePdf.addPage(page);
            const bytes = await pagePdf.save();
            pages.push({
                pageNo,
                fileName: `${fileStem}-page-${pageNo}.pdf`,
                bytes,
                hash: await UnstructuredWrapper.hashBytes(bytes)
            });
        }
        return pages;
    }

    async parsePages(
        pages: PreparedPdfPage[],
        abortSignal?: AbortSignal
    ): Promise<ParsedPdfPage[]> {
        if (pages.length === 0) return [];

        let activeJobId: string | undefined;
        try {
            const job = await this.createJob(pages, abortSignal);
            activeJobId = job.id;
            const completedJob = await this.waitForJob(job.id, abortSignal);
            activeJobId = undefined;
            return await this.downloadResults(completedJob, pages, abortSignal);
        } catch (error) {
            if (
                activeJobId &&
                (abortSignal?.aborted || error instanceof UnstructuredJobTimeoutError)
            ) {
                await this.cancelJob(activeJobId);
            }
            throw error;
        }
    }

    private async createJob(
        pages: PreparedPdfPage[],
        abortSignal?: AbortSignal
    ): Promise<JobResponse> {
        const body = new FormData();
        body.append(
            "request_data",
            JSON.stringify({
                job_nodes: [
                    {
                        name: "Partitioner",
                        type: "partition",
                        subtype: "vlm",
                        settings: {
                            output_format: "application/json",
                            is_dynamic: true,
                            allow_fast: true
                        }
                    }
                ]
            })
        );
        for (const page of pages) {
            body.append(
                "input_files",
                new Blob([new Uint8Array(page.bytes)], {type: "application/pdf"}),
                page.fileName
            );
        }

        const job = await this.fetchJson<JobResponse>(`${this.apiUrl}/jobs/`, {
            method: "POST",
            headers: this.getHeaders(),
            body,
            signal: abortSignal
        });
        if (!job.id) throw new Error("Unstructured.io did not return a job ID.");
        return job;
    }

    private async waitForJob(jobId: string, abortSignal?: AbortSignal): Promise<JobResponse> {
        const deadline = Date.now() + this.timeoutMs;
        while (true) {
            const job = await this.fetchJson<JobResponse>(`${this.apiUrl}/jobs/${jobId}`, {
                headers: this.getHeaders(),
                signal: abortSignal
            });
            if (job.status === "COMPLETED") return job;
            if (job.status === "FAILED" || job.status === "STOPPED") {
                throw new Error(`Unstructured.io job ${jobId} ended with status ${job.status}.`);
            }
            if (Date.now() >= deadline) {
                throw new UnstructuredJobTimeoutError(
                    `Unstructured.io job ${jobId} did not complete within ${this.timeoutMs} ms.`
                );
            }
            await UnstructuredWrapper.wait(this.pollIntervalMs, abortSignal);
        }
    }

    private async downloadResults(
        job: JobResponse,
        pages: PreparedPdfPage[],
        abortSignal?: AbortSignal
    ): Promise<ParsedPdfPage[]> {
        const allOutputFiles = job.output_node_files ?? [];
        const partitionOutputFiles = allOutputFiles.filter(
            (outputFile) => outputFile.node_type === "partition"
        );
        const outputFiles = partitionOutputFiles.length > 0 ? partitionOutputFiles : allOutputFiles;
        if (outputFiles.length !== pages.length) {
            throw new Error(
                `Unstructured.io returned ${outputFiles.length} output files for ${pages.length} PDF pages.`
            );
        }

        const downloadedResults = await Promise.all(
            outputFiles.map(async (outputFile) => {
                const query = new URLSearchParams({file_id: outputFile.file_id});
                if (outputFile.node_id) query.set("node_id", outputFile.node_id);
                const elements = await this.fetchJson<Array<Record<string, unknown>>>(
                    `${this.apiUrl}/jobs/${job.id}/download?${query}`,
                    {headers: this.getHeaders(), signal: abortSignal}
                );
                if (!Array.isArray(elements)) {
                    throw new Error("Unstructured.io returned malformed partition output.");
                }
                return {elements, fileName: UnstructuredWrapper.getSourceFileName(elements)};
            })
        );

        const pagesByFileName = new Map(pages.map((page) => [page.fileName, page]));
        const assignedPageNumbers = new Set<number>();
        const results: ParsedPdfPage[] = [];
        const unassignedResults: Array<{elements: Array<Record<string, unknown>>}> = [];

        for (const result of downloadedResults) {
            const page = result.fileName ? pagesByFileName.get(result.fileName) : undefined;
            if (!page || assignedPageNumbers.has(page.pageNo)) {
                unassignedResults.push(result);
                continue;
            }
            assignedPageNumbers.add(page.pageNo);
            results.push(UnstructuredWrapper.toParsedPage(page.pageNo, result.elements));
        }

        const unassignedPages = pages.filter((page) => !assignedPageNumbers.has(page.pageNo));
        if (unassignedPages.length !== unassignedResults.length) {
            throw new Error(
                "Unstructured.io output files could not be mapped to the requested PDF pages."
            );
        }
        unassignedPages.forEach((page, index) => {
            results.push(
                UnstructuredWrapper.toParsedPage(page.pageNo, unassignedResults[index].elements)
            );
        });

        return results.sort((a, b) => a.pageNo - b.pageNo);
    }

    private async cancelJob(jobId: string): Promise<void> {
        try {
            await this.fetcher(`${this.apiUrl}/jobs/${jobId}/cancel`, {
                method: "POST",
                headers: this.getHeaders()
            });
        } catch {}
    }

    private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
        const response = await this.fetcher(url, init);
        if (!response.ok) {
            const body = await response.text();
            throw new UnstructuredApiError(
                response.status,
                `Unstructured.io request failed with status ${response.status}: ${body}`
            );
        }
        return (await response.json()) as T;
    }

    private getHeaders(): HeadersInit {
        return {
            Accept: "application/json",
            "unstructured-api-key": this.apiKey
        };
    }

    private static normalizeApiUrl(apiUrl: string): string {
        const url = new URL(apiUrl.trim());
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
    }

    private static async hashBytes(bytes: Uint8Array): Promise<string> {
        const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
        return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0")
        ).join("");
    }

    private static getSourceFileName(elements: Array<Record<string, unknown>>): string | undefined {
        for (const element of elements) {
            const metadata = element.metadata;
            if (!metadata || typeof metadata !== "object") continue;
            const fileName = (metadata as Record<string, unknown>).filename;
            if (typeof fileName === "string" && fileName) return fileName;
        }
        return undefined;
    }

    private static toParsedPage(
        pageNo: number,
        elements: Array<Record<string, unknown>>
    ): ParsedPdfPage {
        const content = elements
            .map((element) => element.text)
            .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
            .join("\n\n");
        return {pageNo, elements, content};
    }

    private static wait(durationMs: number, abortSignal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (abortSignal?.aborted) {
                reject(abortSignal.reason ?? new DOMException("Aborted", "AbortError"));
                return;
            }
            const onAbort = () => {
                clearTimeout(timeout);
                reject(abortSignal?.reason ?? new DOMException("Aborted", "AbortError"));
            };
            const timeout = setTimeout(() => {
                abortSignal?.removeEventListener("abort", onAbort);
                resolve();
            }, durationMs);
            abortSignal?.addEventListener("abort", onAbort, {once: true});
        });
    }
}

class UnstructuredJobTimeoutError extends Error {}
