import {PDFDocument} from "pdf-lib";

export interface PreparedPdfPage {
    pageNo: number;
    bytes: Uint8Array;
}

export class PdfPageSplitter {
    static async split(
        pdfBytes: Uint8Array,
        startPage: number,
        endPage: number
    ): Promise<PreparedPdfPage[]> {
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pageCount = sourcePdf.getPageCount();
        if (startPage < 1 || endPage < startPage || endPage > pageCount) {
            throw new Error(
                `PDF page range ${startPage}-${endPage} is invalid for a document with ${pageCount} pages.`
            );
        }

        const pages: PreparedPdfPage[] = [];
        for (let pageNo = startPage; pageNo <= endPage; pageNo++) {
            // Disabling generated metadata prevents timestamps from changing the page hash.
            const pagePdf = await PDFDocument.create({updateMetadata: false});
            const [page] = await pagePdf.copyPages(sourcePdf, [pageNo - 1]);
            pagePdf.addPage(page);
            const bytes = await pagePdf.save();
            pages.push({
                pageNo,
                bytes
            });
        }
        return pages;
    }
}
