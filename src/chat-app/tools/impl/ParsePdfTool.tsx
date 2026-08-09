import type {ConvertErrorCode} from "@firecrawl/anydoc-wasm";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD} from "src/constants";
import {anyDocPdfParser, type PdfMarkdownParser} from "src/core/anydoc/AnyDocPdfParser";
import {JUST_BASH_USER_HOME} from "src/core/just-bash-wrapper/types";
import {getPdfSha256} from "src/core/pdf/getPdfSha256";
import {PdfPageSplitter} from "src/core/pdf/PdfPageSplitter";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";

const PDF_PAGE_PARSE_FAILURE_MARKER = "<!-- PDF_PAGE_PARSE_FAILED -->";

const parsePdfParameters = z.object({
    pdfPath: z
        .string()
        .trim()
        .min(1)
        .refine((path) => path.split(/[?#]/, 1)[0].toLowerCase().endsWith(".pdf"), {
            message: "pdfPath must point to a PDF file."
        })
        .describe("The Logseq asset path of the PDF to parse.")
});

type ParsePdfArgs = z.infer<typeof parsePdfParameters>;
type ParsePdfResult = ChatToolSuccessResult<{result: string}> | ChatToolErrorResult;

export class ParsePdfTool extends BaseChatToolWithDefaultUI<ParsePdfArgs, ParsePdfResult> {
    static readonly NAME = "parse_pdf";

    readonly name = ParsePdfTool.NAME;
    readonly description =
        "Parses all pages from a PDF in the current Logseq graph into separate Markdown files. " +
        "Use the PDF Path supplied with an attached Logseq PDF. " +
        "Read the returned files with the bash tool.";
    readonly parameters = parsePdfParameters;

    constructor(private readonly pdfMarkdownParser: PdfMarkdownParser = anyDocPdfParser) {
        super();
    }

    async execute(
        {pdfPath}: ParsePdfArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<ParsePdfResult>> {
        try {
            this.throwIfAborted(context?.abortSignal);
            const pdfBytes = await this.loadPdf(pdfPath, context?.abortSignal);
            const [pdfHash, preparedPages] = await Promise.all([
                getPdfSha256(pdfBytes),
                PdfPageSplitter.split(pdfBytes)
            ]);
            const files = preparedPages.map((page) => ({
                ...page,
                fileName: AnyDocParseResultStore.getFileName(pdfHash, page.pageNo)
            }));
            const storedPages = new Map(
                (await AnyDocParseResultStore.getPages(pdfHash)).map((page) => [
                    page.pageNo,
                    page.content
                ])
            );
            let failedPageCount = files.filter((page) => {
                const content = storedPages.get(page.pageNo);
                return content !== undefined && this.isParseFailure(content);
            }).length;

            for (const page of files) {
                if (storedPages.has(page.pageNo)) continue;
                this.throwIfAborted(context?.abortSignal);
                let markdown: string;
                try {
                    markdown = await this.pdfMarkdownParser.parsePage(page.bytes);
                } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") throw error;
                    failedPageCount++;
                    markdown = this.createParseFailure(
                        page.pageNo,
                        this.getParseErrorMessage(page.pageNo, error)
                    );
                }

                this.throwIfAborted(context?.abortSignal);
                try {
                    await AnyDocParseResultStore.save(pdfHash, page.pageNo, markdown);
                } catch (error) {
                    throw new Error(
                        `Failed to store parsed PDF page ${page.pageNo} as ${AnyDocParseResultStore.getFileName(pdfHash, page.pageNo)}: ${getErrorMessageFromErrObj(error)}`
                    );
                }
            }

            const failedPageRatio = failedPageCount / files.length;
            if (failedPageRatio > CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD) {
                const failedPercentage = Math.round(failedPageRatio * 100);
                const thresholdPercentage = CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD * 100;
                throw new Error(
                    `PDF parsing failed for ${failedPageCount} of ${files.length} pages (${failedPercentage}%), exceeding the allowed ${thresholdPercentage}% page-error threshold.`
                );
            }

            const storePath = `${JUST_BASH_USER_HOME}/${AnyDocParseResultStore.groupName}`;
            return ChatToolResponse.success({
                result: `Parsed pages stored in ${storePath} as: ${pdfHash}-page-<page no>. Use bash to list / search the pages and read the relevent context.`
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return ChatToolResponse.error("PDF parsing was cancelled.");
            }
            return ChatToolResponse.error(
                `Failed to parse PDF ${pdfPath}: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }

    private async loadPdf(pdfPath: string, abortSignal?: AbortSignal): Promise<Uint8Array> {
        const assetUrl = await WindowParentBridge.makeAssetUrl(pdfPath);
        const response = await fetch(assetUrl, {signal: abortSignal});
        if (!response.ok) {
            throw new Error(`Unable to load the PDF (status ${response.status}).`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    private throwIfAborted(abortSignal?: AbortSignal): void {
        abortSignal?.throwIfAborted();
    }

    private isParseFailure(content: string): boolean {
        return content.startsWith(PDF_PAGE_PARSE_FAILURE_MARKER);
    }

    private createParseFailure(pageNo: number, errorMessage: string): string {
        return `${PDF_PAGE_PARSE_FAILURE_MARKER}\n# PDF page parsing failed\n\nParsing failed for page ${pageNo}.\n\nError: ${errorMessage}`;
    }

    private getParseErrorMessage(pageNo: number, error: unknown): string {
        const code = (error as {code?: ConvertErrorCode | "io"} | null)?.code;
        switch (code) {
            case "unsupported":
                return `AnyDoc could not extract text from PDF page ${pageNo}. The page may be image-only or unsupported.`;
            case "encrypted":
                return `PDF page ${pageNo} could not be parsed because the PDF is encrypted or password-protected.`;
            case "malformed":
                return `PDF page ${pageNo} is structurally malformed and could not be converted.`;
            case "resourceLimit":
                return `PDF page ${pageNo} exceeded AnyDoc's conversion safety limits.`;
            case "missingPart":
                return `PDF page ${pageNo} is missing data required for conversion.`;
            case "io":
                return `PDF page ${pageNo} could not be parsed because of an input/output error.`;
            default:
                return `Failed to parse PDF page ${pageNo}: ${getErrorMessageFromErrObj(error)}`;
        }
    }
}
