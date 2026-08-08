import {afterEach, describe, expect, test, vi} from "vitest";

const anyDocMocks = vi.hoisted(() => ({
    initialize: vi.fn(async () => undefined),
    toMarkdownBytes: vi.fn(() => "parsed markdown")
}));

vi.mock("@firecrawl/anydoc-wasm", () => ({
    default: anyDocMocks.initialize,
    toMarkdownBytes: anyDocMocks.toMarkdownBytes
}));
vi.mock("@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm?url", () => ({
    default: "https://plugins.test/anydoc.wasm"
}));

import {AnyDocPdfParser} from "../../../../src/core/anydoc/AnyDocPdfParser";

describe("AnyDocPdfParser", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        anyDocMocks.initialize.mockClear();
        anyDocMocks.toMarkdownBytes.mockClear();
    });

    test("loads bytes lazily and initializes only once", async () => {
        const wasmBytes = new Uint8Array([0, 97, 115, 109]);
        const fetchMock = vi.fn(async () => new Response(wasmBytes));
        vi.stubGlobal("fetch", fetchMock);
        const parser = new AnyDocPdfParser();

        expect(fetchMock).not.toHaveBeenCalled();
        await expect(parser.parsePage(new Uint8Array([1]))).resolves.toBe("parsed markdown");
        await expect(parser.parsePage(new Uint8Array([2]))).resolves.toBe("parsed markdown");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(anyDocMocks.initialize).toHaveBeenCalledTimes(1);
        expect(anyDocMocks.initialize).toHaveBeenCalledWith({
            module_or_path: expect.any(ArrayBuffer)
        });
        expect(anyDocMocks.toMarkdownBytes).toHaveBeenNthCalledWith(1, new Uint8Array([1]), "pdf");
        expect(anyDocMocks.toMarkdownBytes).toHaveBeenNthCalledWith(2, new Uint8Array([2]), "pdf");
    });

    test("retries after initialization fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(new Uint8Array([1])))
        );
        anyDocMocks.initialize
            .mockRejectedValueOnce(new Error("init failed"))
            .mockResolvedValueOnce(undefined);
        const parser = new AnyDocPdfParser();

        await expect(parser.parsePage(new Uint8Array([1]))).rejects.toThrow("init failed");
        await expect(parser.parsePage(new Uint8Array([1]))).resolves.toBe("parsed markdown");
        expect(anyDocMocks.initialize).toHaveBeenCalledTimes(2);
    });
});
