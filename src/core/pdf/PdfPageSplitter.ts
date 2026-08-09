import {PDFDocument} from "pdf-lib";

export interface PreparedPdfPage {
    pageNo: number;
    bytes: Uint8Array;
}

export class PdfPageSplitter {
    static async split(pdfBytes: Uint8Array): Promise<PreparedPdfPage[]> {
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pageCount = sourcePdf.getPageCount();

        const pages: PreparedPdfPage[] = [];
        for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
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
