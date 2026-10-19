import {afterEach, describe, expect, test, vi} from "vitest";
import {createSecureFetch} from "../../../../../src/core/just-bash-wrapper/network";
import {LOGSEQ_PROXY_FINAL_URL_HEADER} from "../../../../../src/logseq/LogseqHttpProxy";

describe("allowlisted fetch", () => {
    afterEach(() => vi.useRealTimers());
    test("rejects redirect targets outside the allowlist", async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: {location: "https://example.com/private"}
            })
        );

        await expect(createSecureFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
            /Network access denied/
        );
    });

    test("converts POST to GET for a 303 redirect", async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 303,
                    headers: {location: "https://api.github.com/final"}
                })
            )
            .mockResolvedValueOnce(new Response("ok", {status: 200}));

        const result = await createSecureFetch(fetchImpl)("https://github.com/start", {
            method: "POST",
            body: "data"
        });

        expect(new TextDecoder().decode(result.body)).toBe("ok");
        expect(fetchImpl).toHaveBeenNthCalledWith(
            2,
            expect.any(URL),
            expect.objectContaining({method: "GET", body: undefined})
        );
    });

    test("fails closed when the browser hides a redirect target", async () => {
        const response = new Response(null, {status: 200});
        Object.defineProperty(response, "type", {value: "opaqueredirect"});
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

        await expect(createSecureFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
            /destination is hidden/
        );
    });

    test("rejects a patched-fetch final URL outside the allowlist", async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response("private", {
                headers: {[LOGSEQ_PROXY_FINAL_URL_HEADER]: "https://example.com/private"}
            })
        );

        await expect(createSecureFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
            /Network access denied/
        );
    });

    test.each([
        "https://github.com/download",
        "https://files.pythonhosted.org/package.whl"
    ])("accepts downloads above the previous limits: %s", async (url) => {
        const bytes = new Uint8Array(16 * 1024 * 1024 + 1);
        bytes[0] = 255;
        bytes[bytes.length - 1] = 128;
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(bytes, {
                headers: {"content-length": String(bytes.length)}
            })
        );
        const result = await createSecureFetch(fetchImpl)(url);
        expect(result.body.byteLength).toBe(bytes.length);
        expect(result.body[0]).toBe(255);
        expect(result.body[bytes.length - 1]).toBe(128);
    });

    test("does not impose an artifact-specific integrity policy", async () => {
        const url =
            "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl";
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("not scipy"));

        const result = await createSecureFetch(fetchImpl)(url);
        expect(new TextDecoder().decode(result.body)).toBe("not scipy");
    });

    test("accepts streamed downloads without declared size", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(11 * 1024 * 1024));
                controller.enqueue(new Uint8Array([255]));
                controller.close();
            }
        });
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
        const result = await createSecureFetch(fetchImpl)("https://github.com/download");
        expect(result.body.length).toBe(11 * 1024 * 1024 + 1);
        expect(result.body.at(-1)).toBe(255);
    });

    test("rejects an unlisted wheel before invoking transport", async () => {
        const fetchImpl = vi.fn<typeof fetch>();
        await expect(
            createSecureFetch(fetchImpl)("https://unlisted.invalid/package.whl")
        ).rejects.toThrow(/Network access denied/);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test.each([
        "GET",
        "HEAD",
        "POST"
    ])("allows local %s requests with credential omission", async (method) => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null));
        await createSecureFetch(fetchImpl)("http://127.0.0.1:12315/api", {method});
        expect(fetchImpl).toHaveBeenCalledWith(
            expect.any(URL),
            expect.objectContaining({method, credentials: "omit", redirect: "manual"})
        );
    });

    test("returns the validated proxy final URL and removes the internal header", async () => {
        const response = new Response("ok", {
            headers: {[LOGSEQ_PROXY_FINAL_URL_HEADER]: "https://api.github.com/final"}
        });
        Object.defineProperty(response, "url", {value: "https://github.com/start"});
        const result = await createSecureFetch(vi.fn<typeof fetch>().mockResolvedValue(response))(
            "https://github.com/start"
        );
        expect(result.url).toBe("https://api.github.com/final");
        expect(result.headers).not.toHaveProperty(LOGSEQ_PROXY_FINAL_URL_HEADER);
    });

    test("does not contact transport for an already-aborted signal", async () => {
        const fetchImpl = vi.fn<typeof fetch>();
        const controller = new AbortController();
        controller.abort(new Error("cancelled"));
        await expect(
            createSecureFetch(fetchImpl)("https://github.com", {signal: controller.signal})
        ).rejects.toThrow("cancelled");
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test("cancels a transport that ignores its signal and consumes late rejection", async () => {
        const deferred = Promise.withResolvers<Response>();
        const controller = new AbortController();
        const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(deferred.promise);
        const request = createSecureFetch(fetchImpl)("https://github.com", {
            signal: controller.signal
        });
        await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
        controller.abort(new Error("cancelled"));
        await expect(request).rejects.toThrow("cancelled");
        deferred.reject(new Error("late transport failure"));
    });

    test("times out body consumption and removes the caller abort listener", async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const removeListener = vi.spyOn(controller.signal, "removeEventListener");
        const response = new Response(null);
        const read = vi.spyOn(response, "arrayBuffer").mockReturnValue(new Promise(() => {}));
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
        const request = createSecureFetch(fetchImpl)("https://github.com", {
            signal: controller.signal,
            timeoutMs: 10
        });
        const assertion = expect(request).rejects.toMatchObject({name: "AbortError"});
        await vi.advanceTimersByTimeAsync(10);
        await assertion;
        expect(read).toHaveBeenCalled();
        expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
        expect(vi.getTimerCount()).toBe(0);
    });

    test("clears the timeout after success", async () => {
        vi.useFakeTimers();
        await createSecureFetch(vi.fn<typeof fetch>().mockResolvedValue(new Response("ok")))(
            "https://github.com"
        );
        expect(vi.getTimerCount()).toBe(0);
    });

    test("enforces redirect limits and supports opting out", async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockImplementation(
                async () => new Response(null, {status: 302, headers: {location: "/next"}})
            );
        await expect(
            createSecureFetch(fetchImpl)("https://github.com/start", {maxRedirects: 1})
        ).rejects.toThrow(/redirect limit/);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const result = await createSecureFetch(fetchImpl)("https://github.com/start", {
            followRedirects: false
        });
        expect(result.status).toBe(302);
    });
});
