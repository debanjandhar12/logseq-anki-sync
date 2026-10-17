import {configure} from "@zip.js/zip.js/lib/zip-core-native.js";
import {afterEach, describe, expect, test} from "vitest";
import {EpubArchive} from "../../../../../../src/core/anydoc/splitter/epub/EpubArchive";
import {createEpub, readZip} from "../../fixtures/createEpub";

afterEach(() => configure({useCompressionStream: true}));

describe("EPUB browser streams", () => {
    test.each([
        true,
        false
    ])("round trips deflated resources with native streams=%s", async (useCompressionStream) => {
        configure({useCompressionStream});
        const bytes = await createEpub({
            level: 6,
            entries: {"OPS/large.txt": "sample resource ".repeat(100_000)}
        });
        const archive = await EpubArchive.open(bytes);
        const output = await readZip(await archive.withPackage("OPS/book.opf", "<package/>"));
        expect(new TextDecoder().decode(output["OPS/large.txt"])).toBe(
            "sample resource ".repeat(100_000)
        );
        expect(new TextDecoder().decode(output["OPS/book.opf"])).toBe("<package/>");
    });

    test("timer cancellation interrupts extraction and repackaging", async () => {
        const bytes = await createEpub({
            level: 6,
            entries: {"OPS/large.txt": new Uint8Array(8 * 1024 * 1024)}
        });
        const extracting = new AbortController();
        const opening = EpubArchive.open(bytes, extracting.signal);
        setTimeout(() => extracting.abort(), 0);
        await expect(opening).rejects.toMatchObject({name: "AbortError"});
        const archive = await EpubArchive.open(bytes);
        const writing = new AbortController();
        const output = archive.withPackage("OPS/book.opf", "<package/>", writing.signal);
        setTimeout(() => writing.abort(), 0);
        await expect(output).rejects.toMatchObject({name: "AbortError"});
    });
});
