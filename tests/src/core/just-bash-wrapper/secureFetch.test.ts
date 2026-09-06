import {describe, expect, test, vi} from "vitest";
import {createAllowlistedFetch} from "../../../../src/core/just-bash-wrapper/network";
import {LOGSEQ_PROXY_FINAL_URL_HEADER} from "../../../../src/logseq/LogseqHttpProxy";

describe("allowlisted fetch", () => {
    test("rejects redirect targets outside the allowlist", async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: {location: "https://example.com/private"}
            })
        );

        await expect(createAllowlistedFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
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

        const result = await createAllowlistedFetch(fetchImpl)("https://github.com/start", {
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

        await expect(createAllowlistedFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
            /destination is hidden/
        );
    });

    test("rejects a patched-fetch final URL outside the allowlist", async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response("private", {
                headers: {[LOGSEQ_PROXY_FINAL_URL_HEADER]: "https://example.com/private"}
            })
        );

        await expect(createAllowlistedFetch(fetchImpl)("https://github.com/start")).rejects.toThrow(
            /Network access denied/
        );
    });

    test("enforces the response limit when streaming is unavailable", async () => {
        const response = new Response(new Uint8Array(10 * 1024 * 1024 + 1));
        Object.defineProperty(response, "body", {value: null});
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

        await expect(createAllowlistedFetch(fetchImpl)("https://github.com/file")).rejects.toThrow(
            /size limit/
        );
    });

    test("rejects an untrusted SciPy wheel despite its larger size allowance", async () => {
        const url =
            "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl";
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("not scipy"));

        await expect(createAllowlistedFetch(fetchImpl)(url)).rejects.toThrow(/integrity check/);
    });
});
