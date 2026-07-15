import {PDFDocument} from "pdf-lib";

export interface PreparedPdfPage {
    pageNo: number;
    fileName: string;
    bytes: Uint8Array;
    hash: string;
}

export class PdfPageSplitter {
    static async split(
        pdfBytes: Uint8Array,
        startPage: number,
        endPage: number,
        sourceFileName: string
    ): Promise<PreparedPdfPage[]> {
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pageCount = sourcePdf.getPageCount();
        if (startPage < 1 || endPage < startPage || endPage > pageCount) {
            throw new Error(
                `PDF page range ${startPage}-${endPage} is invalid for a document with ${pageCount} pages.`
            );
        }

        const fileStem = sourceFileName.replace(/\.pdf$/i, "") || "document";
        const pages: PreparedPdfPage[] = [];
        for (let pageNo = startPage; pageNo <= endPage; pageNo++) {
            // Disabling generated metadata prevents timestamps from changing the page hash.
            const pagePdf = await PDFDocument.create({updateMetadata: false});
            const [page] = await pagePdf.copyPages(sourcePdf, [pageNo - 1]);
            pagePdf.addPage(page);
            const bytes = await pagePdf.save();
            pages.push({
                pageNo,
                fileName: `${fileStem}-page-${pageNo}.pdf`,
                bytes,
                hash: await PdfPageSplitter.hash(bytes)
            });
        }
        return pages;
    }

    private static async hash(bytes: Uint8Array): Promise<string> {
        const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
        return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0")
        ).join("");
    }
}
