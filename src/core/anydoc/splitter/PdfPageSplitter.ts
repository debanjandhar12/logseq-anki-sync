import {PDFDocument} from "pdf-lib";
import type {PreparedDocumentPage} from "../types";

export class PdfPageSplitter {
    static async *split(
        pdfBytes: Uint8Array,
        abortSignal?: AbortSignal
    ): AsyncGenerator<PreparedDocumentPage> {
        abortSignal?.throwIfAborted();
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const pageCount = sourcePdf.getPageCount();
        if (pageCount === 0) throw new Error("The PDF contains no pages.");

        for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
            abortSignal?.throwIfAborted();
            // Disabling generated metadata prevents timestamps from changing the page hash.
            const pagePdf = await PDFDocument.create({updateMetadata: false});
            const [page] = await pagePdf.copyPages(sourcePdf, [pageNo - 1]);
            pagePdf.addPage(page);
            const bytes = await pagePdf.save();
            yield {
                pageNo,
                bytes
            };
            // Let cancellation events run between synchronous conversions in the caller.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
}
