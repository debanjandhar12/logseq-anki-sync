import {PDFDocument} from "pdf-lib";
import {beforeEach, describe, expect, test, vi} from "vitest";
import type {PreparedPdfPage} from "../../../../src/core/unstructured-wrapper/types";
import {
    UnstructuredApiError,
    UnstructuredWrapper
} from "../../../../src/core/unstructured-wrapper/UnstructuredWrapper";

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {"Content-Type": "application/json"}
    });

describe("UnstructuredWrapper", () => {
    let sourcePdfBytes: Uint8Array;

    beforeEach(async () => {
        const pdf = await PDFDocument.create();
        pdf.addPage();
        pdf.addPage();
        pdf.addPage();
        sourcePdfBytes = await pdf.save();
    });

    test("splits requested pages and calculates stable page hashes", async () => {
        const wrapper = new UnstructuredWrapper({
            apiKey: "key",
            apiUrl: "https://platform-api.transform.unstructured.io/api/v1"
        });

        const first = await wrapper.splitPdfPages(sourcePdfBytes, 2, 3, "source.pdf");
        const second = await wrapper.splitPdfPages(sourcePdfBytes, 2, 3, "source.pdf");

        expect(first.map(({pageNo, fileName, hash}) => ({pageNo, fileName, hash}))).toEqual(
            second.map(({pageNo, fileName, hash}) => ({pageNo, fileName, hash}))
        );
        expect(first).toHaveLength(2);
        expect(first[0]).toMatchObject({
            pageNo: 2,
            fileName: "source-page-2.pdf",
            hash: expect.stringMatching(/^[a-f0-9]{64}$/)
        });
    });

    test("rejects ranges beyond the PDF page count", async () => {
        const wrapper = new UnstructuredWrapper({
            apiKey: "key",
            apiUrl: "https://example.com/api/v1"
        });

        await expect(wrapper.splitPdfPages(sourcePdfBytes, 2, 4, "source.pdf")).rejects.toThrow(
            "document with 3 pages"
        );
    });

    test("uploads all pages in one Auto job and maps downloaded output by filename", async () => {
        let pollCount = 0;
        const fetcherMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.endsWith("/jobs/") && init?.method === "POST") {
                const body = init.body as FormData;
                const requestData = JSON.parse(body.get("request_data") as string);
                expect(requestData).toEqual({
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
                });
                expect(body.getAll("input_files").map((file) => (file as File).name)).toEqual([
                    "source-page-1.pdf",
                    "source-page-2.pdf"
                ]);
                return jsonResponse({id: "job-1", status: "SCHEDULED"});
            }
            if (url.endsWith("/jobs/job-1")) {
                pollCount++;
                return pollCount === 1
                    ? jsonResponse({id: "job-1", status: "IN_PROGRESS"})
                    : jsonResponse({
                          id: "job-1",
                          status: "COMPLETED",
                          output_node_files: [
                              {node_id: "node-1", file_id: "output-2", node_type: "partition"},
                              {node_id: "node-1", file_id: "output-1", node_type: "partition"}
                          ]
                      });
            }
            if (url.includes("file_id=output-2")) {
                return jsonResponse([
                    {text: "Second page", metadata: {filename: "source-page-2.pdf"}}
                ]);
            }
            if (url.includes("file_id=output-1")) {
                return jsonResponse([
                    {text: "First title", metadata: {filename: "source-page-1.pdf"}},
                    {text: "First body", metadata: {filename: "source-page-1.pdf"}}
                ]);
            }
            throw new Error(`Unexpected request: ${url}`);
        });
        const fetcher = fetcherMock as typeof fetch;
        const wrapper = new UnstructuredWrapper({
            apiKey: "api-key",
            apiUrl: "https://platform-api.transform.unstructured.io/api/v1/",
            fetcher,
            pollIntervalMs: 0
        });
        const pages: PreparedPdfPage[] = [
            {pageNo: 1, fileName: "source-page-1.pdf", bytes: new Uint8Array([1]), hash: "one"},
            {pageNo: 2, fileName: "source-page-2.pdf", bytes: new Uint8Array([2]), hash: "two"}
        ];

        await expect(wrapper.parsePages(pages)).resolves.toEqual([
            {
                pageNo: 1,
                elements: [
                    {text: "First title", metadata: {filename: "source-page-1.pdf"}},
                    {text: "First body", metadata: {filename: "source-page-1.pdf"}}
                ],
                content: "First title\n\nFirst body"
            },
            {
                pageNo: 2,
                elements: [{text: "Second page", metadata: {filename: "source-page-2.pdf"}}],
                content: "Second page"
            }
        ]);
        expect(fetcherMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
            1
        );
    });

    test("cancels a job that exceeds the polling timeout", async () => {
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.endsWith("/jobs/") && init?.method === "POST") {
                return jsonResponse({id: "slow-job", status: "SCHEDULED"});
            }
            if (url.endsWith("/jobs/slow-job") && init?.method !== "POST") {
                return jsonResponse({id: "slow-job", status: "IN_PROGRESS"});
            }
            if (url.endsWith("/jobs/slow-job/cancel")) return jsonResponse({});
            throw new Error(`Unexpected request: ${url}`);
        }) as typeof fetch;
        const wrapper = new UnstructuredWrapper({
            apiKey: "api-key",
            apiUrl: "https://example.com/api/v1",
            fetcher,
            pollIntervalMs: 0,
            timeoutMs: 0
        });
        const page: PreparedPdfPage = {
            pageNo: 1,
            fileName: "source-page-1.pdf",
            bytes: new Uint8Array([1]),
            hash: "one"
        };

        await expect(wrapper.parsePages([page])).rejects.toThrow("did not complete");
        expect(fetcher).toHaveBeenCalledWith(
            "https://example.com/api/v1/jobs/slow-job/cancel",
            expect.objectContaining({method: "POST"})
        );
    });

    test("surfaces API status codes", async () => {
        const wrapper = new UnstructuredWrapper({
            apiKey: "bad-key",
            apiUrl: "https://example.com/api/v1",
            fetcher: vi.fn().mockResolvedValue(jsonResponse({detail: "invalid key"}, 401))
        });
        const page: PreparedPdfPage = {
            pageNo: 1,
            fileName: "source-page-1.pdf",
            bytes: new Uint8Array([1]),
            hash: "one"
        };

        const error = await wrapper.parsePages([page]).catch((caught) => caught);
        expect(error).toBeInstanceOf(UnstructuredApiError);
        expect(error.statusCode).toBe(401);
    });

    test("rejects output that cannot be correlated by filename", async () => {
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.endsWith("/jobs/") && init?.method === "POST") {
                return jsonResponse({id: "job-1", status: "SCHEDULED"});
            }
            if (url.endsWith("/jobs/job-1")) {
                return jsonResponse({
                    id: "job-1",
                    status: "COMPLETED",
                    output_node_files: [
                        {node_id: "node-1", file_id: "output-1", node_type: "partition"}
                    ]
                });
            }
            if (url.includes("file_id=output-1")) {
                return jsonResponse([{element_id: "block-uuid", text: "Unmapped page"}]);
            }
            throw new Error(`Unexpected request: ${url}`);
        }) as typeof fetch;
        const wrapper = new UnstructuredWrapper({
            apiKey: "api-key",
            apiUrl: "https://example.com/api/v1",
            fetcher
        });
        const page: PreparedPdfPage = {
            pageNo: 1,
            fileName: "source-page-1.pdf",
            bytes: new Uint8Array([1]),
            hash: "one"
        };

        await expect(wrapper.parsePages([page])).rejects.toThrow(
            "could not be mapped to a requested PDF page by filename"
        );
    });

    test("retries transient server errors with exponential backoff", async () => {
        vi.useFakeTimers();
        try {
            let createAttempts = 0;
            const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = input.toString();
                if (url.endsWith("/jobs/") && init?.method === "POST") {
                    createAttempts++;
                    return createAttempts === 1
                        ? jsonResponse({detail: "temporary"}, 503)
                        : jsonResponse({id: "job-1", status: "SCHEDULED"});
                }
                if (url.endsWith("/jobs/job-1")) {
                    return jsonResponse({
                        id: "job-1",
                        status: "COMPLETED",
                        output_node_files: [
                            {node_id: "node-1", file_id: "output-1", node_type: "partition"}
                        ]
                    });
                }
                if (url.includes("file_id=output-1")) {
                    return jsonResponse([
                        {text: "Page", metadata: {filename: "source-page-1.pdf"}}
                    ]);
                }
                throw new Error(`Unexpected request: ${url}`);
            }) as typeof fetch;
            const wrapper = new UnstructuredWrapper({
                apiKey: "api-key",
                apiUrl: "https://example.com/api/v1",
                fetcher
            });
            const page: PreparedPdfPage = {
                pageNo: 1,
                fileName: "source-page-1.pdf",
                bytes: new Uint8Array([1]),
                hash: "one"
            };

            const result = wrapper.parsePages([page]);
            await vi.advanceTimersByTimeAsync(3_000);

            await expect(result).resolves.toMatchObject([{pageNo: 1, content: "Page"}]);
            expect(createAttempts).toBe(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test("times out stalled requests", async () => {
        vi.useFakeTimers();
        try {
            const fetcher = vi.fn(
                (_input: RequestInfo | URL, init?: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
                            once: true
                        });
                    })
            ) as typeof fetch;
            const wrapper = new UnstructuredWrapper({
                apiKey: "api-key",
                apiUrl: "https://example.com/api/v1",
                fetcher,
                requestTimeoutMs: 10
            });
            const page: PreparedPdfPage = {
                pageNo: 1,
                fileName: "source-page-1.pdf",
                bytes: new Uint8Array([1]),
                hash: "one"
            };

            const result = wrapper.parsePages([page]);
            const rejection = expect(result).rejects.toThrow(
                "request did not complete within 10 ms"
            );
            await vi.runAllTimersAsync();

            await rejection;
            expect(fetcher).toHaveBeenCalledTimes(4);
        } finally {
            vi.useRealTimers();
        }
    });

    test("polls every ten seconds by default", async () => {
        vi.useFakeTimers();
        try {
            let pollCount = 0;
            const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = input.toString();
                if (url.endsWith("/jobs/") && init?.method === "POST") {
                    return jsonResponse({id: "job-1", status: "SCHEDULED"});
                }
                if (url.endsWith("/jobs/job-1")) {
                    pollCount++;
                    return pollCount === 1
                        ? jsonResponse({id: "job-1", status: "IN_PROGRESS"})
                        : jsonResponse({
                              id: "job-1",
                              status: "COMPLETED",
                              output_node_files: [
                                  {
                                      node_id: "node-1",
                                      file_id: "output-1",
                                      node_type: "partition"
                                  }
                              ]
                          });
                }
                if (url.includes("file_id=output-1")) {
                    return jsonResponse([
                        {text: "Page", metadata: {filename: "source-page-1.pdf"}}
                    ]);
                }
                throw new Error(`Unexpected request: ${url}`);
            }) as typeof fetch;
            const wrapper = new UnstructuredWrapper({
                apiKey: "api-key",
                apiUrl: "https://example.com/api/v1",
                fetcher
            });
            const page: PreparedPdfPage = {
                pageNo: 1,
                fileName: "source-page-1.pdf",
                bytes: new Uint8Array([1]),
                hash: "one"
            };

            const result = wrapper.parsePages([page]);
            await vi.advanceTimersByTimeAsync(9_999);
            expect(pollCount).toBe(1);
            await vi.advanceTimersByTimeAsync(1);

            await expect(result).resolves.toMatchObject([{pageNo: 1}]);
            expect(pollCount).toBe(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
