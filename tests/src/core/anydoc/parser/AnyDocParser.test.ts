import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    initialize: vi.fn(async () => undefined),
    toMarkdownBytes: vi.fn(() => "parsed markdown")
}));

vi.mock("@firecrawl/anydoc-wasm", () => ({
    default: mocks.initialize,
    toMarkdownBytes: mocks.toMarkdownBytes
}));
vi.mock("@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm?url", () => ({
    default: "https://plugins.test/anydoc.wasm"
}));

describe("static AnyDocParser", () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.initialize.mockReset().mockResolvedValue(undefined);
        mocks.toMarkdownBytes.mockReset().mockReturnValue("parsed markdown");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(new Uint8Array([0, 97, 115, 109])))
        );
    });

    afterEach(() => vi.unstubAllGlobals());

    test("lazily shares initialization across concurrent formats", async () => {
        const {AnyDocParser} = await import("../../../../../src/core/anydoc/parser/AnyDocParser");
        expect(fetch).not.toHaveBeenCalled();
        const bytes = new Uint8Array([1]);
        await expect(
            Promise.all([AnyDocParser.parsePdfPage(bytes), AnyDocParser.parseEpubPage(bytes)])
        ).resolves.toEqual(["parsed markdown", "parsed markdown"]);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(mocks.initialize).toHaveBeenCalledTimes(1);
        expect(mocks.toMarkdownBytes).toHaveBeenCalledWith(bytes, "pdf");
        expect(mocks.toMarkdownBytes).toHaveBeenCalledWith(bytes, "epub");
    });

    test("retries initialization failure without caching it as a conversion failure", async () => {
        const {AnyDocParser, AnyDocInitializationError} = await import(
            "../../../../../src/core/anydoc/parser/AnyDocParser"
        );
        mocks.initialize.mockRejectedValueOnce(new Error("init failed"));
        await expect(AnyDocParser.parsePdfPage(new Uint8Array())).rejects.toBeInstanceOf(
            AnyDocInitializationError
        );
        await expect(AnyDocParser.parseEpubPage(new Uint8Array())).resolves.toBe("parsed markdown");
        expect(mocks.initialize).toHaveBeenCalledTimes(2);
    });

    test("retries HTTP initialization failures", async () => {
        const {AnyDocParser} = await import("../../../../../src/core/anydoc/parser/AnyDocParser");
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, {status: 503}));
        await expect(AnyDocParser.parsePdfPage(new Uint8Array())).rejects.toThrow(
            "initialize AnyDoc"
        );
        await expect(AnyDocParser.parsePdfPage(new Uint8Array())).resolves.toBe("parsed markdown");
    });

    test("propagates conversion errors without reinitializing", async () => {
        const {AnyDocParser} = await import("../../../../../src/core/anydoc/parser/AnyDocParser");
        const error = Object.assign(new Error("bad chapter"), {code: "malformed"});
        mocks.toMarkdownBytes.mockImplementationOnce(() => {
            throw error;
        });
        await expect(AnyDocParser.parseEpubPage(new Uint8Array())).rejects.toBe(error);
        await AnyDocParser.parsePdfPage(new Uint8Array());
        expect(mocks.initialize).toHaveBeenCalledTimes(1);
    });
});
