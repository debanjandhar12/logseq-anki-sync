import {describe, expect, test} from "vitest";
import {LOGSEQ_PROXY_FINAL_URL_HEADER, LogseqHttpProxy} from "../../../src/logseq/LogseqHttpProxy";

type ProxyInternals = {
    experRequest(options: {
        url: string;
        method: "GET";
        headers: Record<string, string>;
        returnType: "text";
        signal: AbortSignal;
    }): Promise<unknown>;
    getReturnType(request: Request): string;
    toResponse(result: unknown, returnType: "text" | "arraybuffer"): Response;
};

const proxy = LogseqHttpProxy as unknown as ProxyInternals;

describe("LogseqHttpProxy binary responses", () => {
    test("selects binary mode only for GET WASM requests", () => {
        expect(proxy.getReturnType(new Request("https://plugins.test/anydoc.wasm"))).toBe(
            "arraybuffer"
        );
        expect(proxy.getReturnType(new Request("https://plugins.test/api"))).toBe("text");
        expect(
            proxy.getReturnType(new Request("https://plugins.test/anydoc.wasm", {method: "POST"}))
        ).toBe("text");
    });

    test.each([
        new Uint8Array([0, 97, 115, 109]),
        [0, 97, 115, 109],
        {type: "Buffer", data: [0, 97, 115, 109]}
    ])("reconstructs binary host payloads", async (body) => {
        const response = proxy.toResponse({status: 200, ok: true, body}, "arraybuffer");

        expect(new Uint8Array(await response.arrayBuffer())).toEqual(
            new Uint8Array([0, 97, 115, 109])
        );
    });

    test("preserves text responses", async () => {
        const response = proxy.toResponse(
            {status: 200, ok: true, body: {ok: true}, url: "https://example.com/final"},
            "text"
        );
        await expect(response.text()).resolves.toBe('{"ok":true}');
        expect(response.headers.get(LOGSEQ_PROXY_FINAL_URL_HEADER)).toBe(
            "https://example.com/final"
        );
    });
});

describe("LogseqHttpProxy cancellation", () => {
    test("stops waiting for a host callback when aborted", async () => {
        const controller = new AbortController();
        const originalLogseq = globalThis.logseq;
        globalThis.logseq = {
            baseInfo: {id: "test"},
            _execCallableAPIAsync: async () => "request-id",
            Request: {once: () => undefined}
        } as unknown as typeof logseq;

        try {
            const request = proxy.experRequest({
                url: "https://example.com",
                method: "GET",
                headers: {},
                returnType: "text",
                signal: controller.signal
            });
            controller.abort();
            await expect(request).rejects.toBeDefined();
        } finally {
            globalThis.logseq = originalLogseq;
        }
    });
});
