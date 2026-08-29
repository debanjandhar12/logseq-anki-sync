import {PDFDocument} from "pdf-lib";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {ParsePdfTool} from "../../../../../src/chat-app/tools/impl/ParsePdfTool";
import type {PdfMarkdownParser} from "../../../../../src/core/anydoc/AnyDocParser";
import {getPdfSha256} from "../../../../../src/core/anydoc/pdf/getPdfSha256";
import {AnyDocParseResultStore} from "../../../../../src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {WindowParentBridge} from "../../../../../src/logseq/WindowParentBridge";

const PDF_PAGE_PARSE_FAILURE_MARKER = "<!-- PDF_PAGE_PARSE_FAILED -->";

async function createPdf(pageCount: number): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    for (let pageNo = 0; pageNo < pageCount; pageNo++) pdf.addPage();
    return pdf.save();
}

async function getStoredPage(pdfHash: string, pageNo: number): Promise<string | undefined> {
    return LogseqPluginStorageManager.getFileContent(
        AnyDocParseResultStore.groupName,
        AnyDocParseResultStore.getFileName(pdfHash, pageNo)
    );
}

function createStoredPageFailure(pageNo: number, errorMessage: string): string {
    return `${PDF_PAGE_PARSE_FAILURE_MARKER}\n# PDF page parsing failed\n\nParsing failed for page ${pageNo}.\n\nError: ${errorMessage}`;
}

describe("ParsePdfTool", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("parse-pdf-tool-test");
        vi.spyOn(WindowParentBridge, "makeAssetUrl").mockResolvedValue(
            "https://assets.test/file.pdf"
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test("accepts a PDF path without a page range", () => {
        const parameters = new ParsePdfTool({parsePdfPage: vi.fn()}).parameters;

        expect(parameters.safeParse({pdfPath: "../assets/file.pdf"}).success).toBe(true);
        expect(parameters.safeParse({pdfPath: "../assets/file.txt"}).success).toBe(false);
    });

    test("parses all missing pages, stores Markdown, and returns the file pattern", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const parsePdfPage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockResolvedValueOnce("page one")
            .mockResolvedValueOnce("page two")
            .mockResolvedValueOnce("page three");

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        const files = [`${pdfHash}-page-1.md`, `${pdfHash}-page-2.md`, `${pdfHash}-page-3.md`];
        expect(response.result).toEqual({
            success: true,
            result: `Parsed pages stored in /home/user/anydoc-parse-results as: ${pdfHash}-page-<page no>. Use bash to list / search the pages and read the relevent context.`
        });
        expect(parsePdfPage).toHaveBeenCalledTimes(3);
        await expect(
            LogseqPluginStorageManager.getFileContent(AnyDocParseResultStore.groupName, files[0])
        ).resolves.toBe("page one");
        await expect(
            LogseqPluginStorageManager.getFileContent(AnyDocParseResultStore.groupName, files[2])
        ).resolves.toBe("page three");
    });

    test("reuses stored pages and parses only misses", async () => {
        const pdfBytes = await createPdf(2);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        await AnyDocParseResultStore.save(pdfHash, 1, "cached");
        const parsePdfPage = vi.fn(async () => "new page");

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(response.result.success).toBe(true);
        expect(parsePdfPage).toHaveBeenCalledTimes(1);
        await expect(
            LogseqPluginStorageManager.getFileContent(
                AnyDocParseResultStore.groupName,
                `${pdfHash}-page-1.md`
            )
        ).resolves.toBe("cached");
    });

    test("does not parse any pages when all PDF page files exist", async () => {
        const pdfBytes = await createPdf(2);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        await AnyDocParseResultStore.save(pdfHash, 1, "cached page one");
        await AnyDocParseResultStore.save(
            pdfHash,
            2,
            createStoredPageFailure(2, "Previously failed")
        );
        const parsePdfPage = vi.fn<PdfMarkdownParser["parsePdfPage"]>();

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(response.result.success).toBe(true);
        expect(parsePdfPage).not.toHaveBeenCalled();
    });

    test("stores a page error without failing when no more than half of pages fail", async () => {
        const pdfBytes = await createPdf(2);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const error = Object.assign(new Error("no text"), {code: "unsupported"});
        const parsePdfPage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce("page two");

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(response.result.success).toBe(true);
        await expect(getStoredPage(pdfHash, 1)).resolves.toContain(
            "Parsing failed for page 1.\n\nError: AnyDoc could not extract text from PDF page 1. The page may be image-only or unsupported."
        );
        await expect(getStoredPage(pdfHash, 2)).resolves.toBe("page two");
    });

    test("stores all page outcomes and fails when more than half of pages fail", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const parsePdfPage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockRejectedValueOnce(Object.assign(new Error("encrypted"), {code: "encrypted"}))
            .mockResolvedValueOnce("page two")
            .mockRejectedValueOnce(Object.assign(new Error("malformed"), {code: "malformed"}));

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(response.result).toEqual({
            success: false,
            error: "Failed to parse PDF ../assets/file.pdf: PDF parsing failed for 2 of 3 pages (67%), exceeding the allowed 50% page-error threshold."
        });
        await expect(getStoredPage(pdfHash, 1)).resolves.toContain(
            "PDF is encrypted or password-protected"
        );
        await expect(getStoredPage(pdfHash, 2)).resolves.toBe("page two");
        await expect(getStoredPage(pdfHash, 3)).resolves.toContain("structurally malformed");
    });

    test("counts cached page errors toward the failure threshold", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        await AnyDocParseResultStore.save(
            pdfHash,
            1,
            createStoredPageFailure(1, "Previously failed")
        );
        const parsePdfPage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockRejectedValueOnce(Object.assign(new Error("I/O failure"), {code: "io"}))
            .mockResolvedValueOnce("page three");

        const response = await new ParsePdfTool({parsePdfPage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(response.result.success).toBe(false);
        expect(parsePdfPage).toHaveBeenCalledTimes(2);
        await expect(getStoredPage(pdfHash, 2)).resolves.toContain(
            "because of an input/output error"
        );
    });

    test("stores completed pages immediately and resumes after cancellation", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const firstParsePage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockResolvedValueOnce("page one")
            .mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));

        const cancelledResponse = await new ParsePdfTool({parsePdfPage: firstParsePage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(cancelledResponse.result).toEqual({
            success: false,
            error: "PDF parsing was cancelled."
        });
        await expect(getStoredPage(pdfHash, 1)).resolves.toBe("page one");
        await expect(getStoredPage(pdfHash, 2)).resolves.toBeUndefined();

        const resumedParsePage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockResolvedValueOnce("page two")
            .mockResolvedValueOnce("page three");
        const resumedResponse = await new ParsePdfTool({parsePdfPage: resumedParsePage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(resumedResponse.result.success).toBe(true);
        expect(resumedParsePage).toHaveBeenCalledTimes(2);
        await expect(getStoredPage(pdfHash, 2)).resolves.toBe("page two");
        await expect(getStoredPage(pdfHash, 3)).resolves.toBe("page three");
    });

    test("retries a page whose result could not be stored", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const originalSave = AnyDocParseResultStore.save;
        const save = vi
            .spyOn(AnyDocParseResultStore, "save")
            .mockImplementationOnce(originalSave)
            .mockRejectedValueOnce(new Error("storage unavailable"));
        const firstParsePage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockResolvedValueOnce("page one")
            .mockResolvedValueOnce("page two");

        const failedResponse = await new ParsePdfTool({parsePdfPage: firstParsePage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(failedResponse.result).toEqual({
            success: false,
            error: `Failed to parse PDF ../assets/file.pdf: Failed to store parsed PDF page 2 as ${pdfHash}-page-2.md: storage unavailable`
        });
        await expect(getStoredPage(pdfHash, 1)).resolves.toBe("page one");
        await expect(getStoredPage(pdfHash, 2)).resolves.toBeUndefined();
        expect(firstParsePage).toHaveBeenCalledTimes(2);

        save.mockRestore();
        const resumedParsePage = vi
            .fn<PdfMarkdownParser["parsePdfPage"]>()
            .mockResolvedValueOnce("page two")
            .mockResolvedValueOnce("page three");
        const resumedResponse = await new ParsePdfTool({parsePdfPage: resumedParsePage}).execute({
            pdfPath: "../assets/file.pdf"
        });

        expect(resumedResponse.result.success).toBe(true);
        expect(resumedParsePage).toHaveBeenCalledTimes(2);
        await expect(getStoredPage(pdfHash, 2)).resolves.toBe("page two");
        await expect(getStoredPage(pdfHash, 3)).resolves.toBe("page three");
    });
});
