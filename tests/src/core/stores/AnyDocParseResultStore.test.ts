import {beforeEach, describe, expect, test} from "vitest";
import {AnyDocParseResultStore} from "../../../../src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const PDF_HASH = "a".repeat(64);

describe("AnyDocParseResultStore", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("anydoc-store-test");
    });

    test("stores Markdown using the PDF hash and page number", async () => {
        const fileName = await AnyDocParseResultStore.save(PDF_HASH, 4, "# Page four");

        expect(fileName).toBe(`${PDF_HASH}-page-4.md`);
        await expect(AnyDocParseResultStore.exists(PDF_HASH, 4)).resolves.toBe(true);
        await expect(
            LogseqPluginStorageManager.getFileContent(AnyDocParseResultStore.groupName, fileName)
        ).resolves.toBe("# Page four");
    });

    test("rejects invalid file identity inputs", () => {
        expect(() => AnyDocParseResultStore.getFileName("unsafe/hash", 1)).toThrow(
            "Invalid PDF hash"
        );
        expect(() => AnyDocParseResultStore.getFileName(PDF_HASH, 0)).toThrow(
            "Invalid PDF page number"
        );
    });
});
