import {PDFDocument} from "pdf-lib";
import {describe, expect, test} from "vitest";
import {PdfPageSplitter} from "../../../../../src/core/anydoc";

async function createPdf(pageCount: number): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    for (let pageNo = 0; pageNo < pageCount; pageNo++) pdf.addPage();
    return pdf.save();
}

describe("PdfPageSplitter", () => {
    test("extracts all pages as one-page PDFs", async () => {
        const pages = [];
        for await (const page of PdfPageSplitter.split(await createPdf(3))) pages.push(page);

        expect(pages.map((page) => page.pageNo)).toEqual([1, 2, 3]);
        for (const page of pages) {
            await expect(PDFDocument.load(page.bytes)).resolves.toMatchObject({});
            expect((await PDFDocument.load(page.bytes)).getPageCount()).toBe(1);
        }
    });
});
