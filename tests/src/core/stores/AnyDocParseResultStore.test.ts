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
        await AnyDocParseResultStore.save(PDF_HASH, 4, "# Page four");
        const fileName = AnyDocParseResultStore.getFileName(PDF_HASH, 4);

        expect(fileName).toBe(`${PDF_HASH}-page-4.md`);
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

    test("gets only exact pages for a PDF in page order", async () => {
        const otherPdfHash = "b".repeat(64);
        await AnyDocParseResultStore.save(PDF_HASH, 10, "page ten");
        await AnyDocParseResultStore.save(PDF_HASH, 2, "page two");
        await AnyDocParseResultStore.save(otherPdfHash, 1, "other PDF");
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            `${PDF_HASH}-page-0.md`,
            "invalid page"
        );
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            `${PDF_HASH}-page-3.txt`,
            "wrong extension"
        );

        await expect(AnyDocParseResultStore.getPages(PDF_HASH)).resolves.toEqual([
            {pageNo: 2, content: "page two"},
            {pageNo: 10, content: "page ten"}
        ]);
    });

    test("rejects an invalid PDF hash when getting pages", async () => {
        await expect(AnyDocParseResultStore.getPages("unsafe/hash")).rejects.toThrow(
            "Invalid PDF hash"
        );
    });
});
