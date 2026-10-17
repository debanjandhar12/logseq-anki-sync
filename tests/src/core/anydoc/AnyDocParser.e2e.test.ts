import {PDFDocument, StandardFonts} from "pdf-lib";
import {describe, expect, test} from "vitest";
import {AnyDocParser, EpubPageSplitter, PdfPageSplitter} from "../../../../src/core/anydoc";
import {collectPages, createEpub} from "./fixtures/createEpub";

describe("AnyDoc real WASM conversion", () => {
    test("converts individual EPUB spine documents without leaking other chapter text", async () => {
        const pages = await collectPages(EpubPageSplitter.split(await createEpub()));
        const second = await AnyDocParser.parseEpubPage(pages[0].bytes);
        const first = await AnyDocParser.parseEpubPage(pages[1].bytes);
        expect(second).toContain("Beta distinctive content");
        expect(second).not.toContain("Alpha distinctive content");
        expect(first).toContain("Alpha distinctive content");
        expect(first).not.toContain("Beta distinctive content");
    });

    test("converts text-bearing standalone PDF pages", async () => {
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        pdf.addPage().drawText("Distinctive PDF content", {font});
        const pages = await collectPages(PdfPageSplitter.split(await pdf.save()));
        expect(await AnyDocParser.parsePdfPage(pages[0].bytes)).toContain(
            "Distinctive PDF content"
        );
    });
});
