import {afterEach, describe, expect, test, vi} from "vitest";
import {LogseqHttpProxy} from "../../../src/logseq/LogseqHttpProxy";

describe("LogseqHttpProxy", () => {
    const originalExecDescriptor = Object.getOwnPropertyDescriptor(logseq, "_execCallableAPIAsync");
    const originalRequestDescriptor = Object.getOwnPropertyDescriptor(logseq, "Request");
    const originalBaseInfoDescriptor = Object.getOwnPropertyDescriptor(logseq, "baseInfo");

    afterEach(() => {
        if (originalExecDescriptor) {
            Object.defineProperty(logseq, "_execCallableAPIAsync", originalExecDescriptor);
        } else {
            Reflect.deleteProperty(logseq, "_execCallableAPIAsync");
        }
        if (originalRequestDescriptor) {
            Object.defineProperty(logseq, "Request", originalRequestDescriptor);
        } else {
            Reflect.deleteProperty(logseq, "Request");
        }
        if (originalBaseInfoDescriptor) {
            Object.defineProperty(logseq, "baseInfo", originalBaseInfoDescriptor);
        } else {
            Reflect.deleteProperty(logseq, "baseInfo");
        }
        vi.restoreAllMocks();
    });

    test("preserves a multipart Request method, headers, and body", async () => {
        const execute = vi.fn().mockResolvedValue("request-1");
        Object.defineProperty(logseq, "_execCallableAPIAsync", {
            configurable: true,
            value: execute
        });
        Object.defineProperty(logseq, "Request", {
            configurable: true,
            value: {
                once: (_event: string, callback: (payload: unknown) => void) =>
                    callback({status: 200, ok: true, body: "{}"})
            }
        });
        Object.defineProperty(logseq, "baseInfo", {
            configurable: true,
            value: {id: "test-plugin"}
        });

        const body = new FormData();
        body.append("request_data", "{}");
        body.append("input_files", new Blob([new Uint8Array([1, 2, 3])]), "page.pdf");
        const request = new Request("https://example.com/api/v1/jobs/", {
            method: "POST",
            headers: {"unstructured-api-key": "api-key"},
            body
        });
        const proxy = LogseqHttpProxy as unknown as {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
        };

        const response = await proxy.fetch(request);

        expect(response.ok).toBe(true);
        const options = execute.mock.calls[0][2] as {
            method: string;
            headers: Record<string, string>;
            data: ArrayBuffer;
        };
        expect(options.method).toBe("POST");
        expect(options.headers["unstructured-api-key"]).toBe("api-key");
        expect(options.headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
        expect(options.data).toBeInstanceOf(ArrayBuffer);
        expect(options.data.byteLength).toBeGreaterThan(3);
    });
});
