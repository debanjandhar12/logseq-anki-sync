import {PDFDocument} from "pdf-lib";
import {describe, expect, test} from "vitest";
import {PdfPageSplitter} from "../../../../src/core/pdf/PdfPageSplitter";

async function createPdf(pageCount: number): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    for (let pageNo = 0; pageNo < pageCount; pageNo++) pdf.addPage();
    return pdf.save();
}

describe("PdfPageSplitter", () => {
    test("extracts an inclusive range as one-page PDFs", async () => {
        const pages = await PdfPageSplitter.split(await createPdf(3), 2, 3);

        expect(pages.map((page) => page.pageNo)).toEqual([2, 3]);
        for (const page of pages) {
            await expect(PDFDocument.load(page.bytes)).resolves.toMatchObject({});
            expect((await PDFDocument.load(page.bytes)).getPageCount()).toBe(1);
        }
    });

    test("rejects ranges outside the document", async () => {
        await expect(PdfPageSplitter.split(await createPdf(2), 2, 3)).rejects.toThrow(
            "invalid for a document with 2 pages"
        );
    });
});
