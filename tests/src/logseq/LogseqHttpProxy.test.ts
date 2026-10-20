import {afterEach, describe, expect, test, vi} from "vitest";
import {LOGSEQ_PROXY_FINAL_URL_HEADER, LogseqHttpProxy} from "../../../src/logseq/LogseqHttpProxy";

type ProxyInternals = {
    experRequest(options: {
        url: string;
        method: "GET";
        headers: Record<string, string>;
        returnType: "text";
        signal: AbortSignal;
    }): Promise<unknown>;
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    toResponse(result: unknown, returnType: "text" | "arraybuffer", method?: string): Response;
};

const proxy = LogseqHttpProxy as unknown as ProxyInternals;

describe("LogseqHttpProxy Vite browser transport", () => {
    const internals = LogseqHttpProxy as unknown as {
        originalFetch: typeof fetch | null;
        fetchInBrowserTest(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    };
    const original = internals.originalFetch;
    afterEach(() => {
        internals.originalFetch = original;
    });

    test("routes external HTTPS requests through Vite server.proxy and records final URL", async () => {
        const fetch = vi.fn().mockResolvedValue(new Response("upstream", {status: 200}));
        internals.originalFetch = fetch;
        const response = await internals.fetchInBrowserTest(
            "https://www.youtube.com/watch?v=example"
        );
        expect(fetch).toHaveBeenCalledWith(
            "/__logseq_http_proxy/www.youtube.com/watch?v=example",
            expect.objectContaining({method: "GET", credentials: "omit", redirect: "manual"})
        );
        expect(response.headers.get(LOGSEQ_PROXY_FINAL_URL_HEADER)).toBe(
            "https://www.youtube.com/watch?v=example"
        );
        expect(await response.text()).toBe("upstream");
    });

    test("leaves local API calls and runtime assets on original fetch", async () => {
        const fetch = vi.fn().mockResolvedValue(new Response("local"));
        internals.originalFetch = fetch;
        for (const url of [
            "http://127.0.0.1:12315/api",
            new URL("/pyodide/pyodide.mjs", window.location.href).href
        ]) {
            await internals.fetchInBrowserTest(url);
            expect(fetch).toHaveBeenLastCalledWith(url, undefined);
        }
    });
});

describe("LogseqHttpProxy binary responses", () => {
    test("requests binary mode for arbitrary paths and methods", async () => {
        const originalLogseq = globalThis.logseq;
        globalThis.logseq = {_execCallableAPIAsync: vi.fn()} as unknown as typeof logseq;
        const request = vi.spyOn(proxy, "experRequest").mockResolvedValue({
            status: 200,
            ok: true,
            body: [0, 255, 128, 65]
        });
        try {
            for (const method of ["GET", "POST"]) {
                for (const path of ["package.whl", "download", "api/export"]) {
                    const response = await proxy.fetch(`https://plugins.test/${path}`, {method});
                    expect(request).toHaveBeenLastCalledWith(
                        expect.objectContaining({method, returnType: "arraybuffer"})
                    );
                    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
                        new Uint8Array([0, 255, 128, 65])
                    );
                }
            }
        } finally {
            request.mockRestore();
            globalThis.logseq = originalLogseq;
        }
    });

    test("binary transport preserves text and JSON decoding", async () => {
        const text = "Unicode text: café 日本語";
        await expect(
            proxy.toResponse(new TextEncoder().encode(text), "arraybuffer").text()
        ).resolves.toBe(text);
        const response = proxy.toResponse(
            {status: 200, ok: true, body: [...new TextEncoder().encode('{"ok":true}')]},
            "arraybuffer"
        );
        await expect(response.json()).resolves.toEqual({ok: true});
    });

    test.each([
        204, 205, 304
    ])("constructs bodyless status %s without decoding a payload", async (status) => {
        const response = proxy.toResponse({status, ok: true, body: undefined}, "arraybuffer");
        expect(response.status).toBe(status);
        expect(response.body).toBeNull();
    });

    test("HEAD responses have no body", () => {
        expect(
            proxy.toResponse({status: 200, ok: true, body: undefined}, "arraybuffer", "HEAD").body
        ).toBeNull();
        expect(proxy.toResponse(undefined, "arraybuffer", "HEAD").body).toBeNull();
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
