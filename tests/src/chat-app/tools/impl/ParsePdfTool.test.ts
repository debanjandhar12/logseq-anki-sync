import {PDFDocument} from "pdf-lib";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {ParsePdfTool} from "../../../../../src/chat-app/tools/impl/ParsePdfTool";
import type {PdfMarkdownParser} from "../../../../../src/core/anydoc/AnyDocPdfParser";
import {getPdfSha256} from "../../../../../src/core/pdf/getPdfSha256";
import {AnyDocParseResultStore} from "../../../../../src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {WindowParentBridge} from "../../../../../src/logseq/WindowParentBridge";

async function createPdf(pageCount: number): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    for (let pageNo = 0; pageNo < pageCount; pageNo++) pdf.addPage();
    return pdf.save();
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

    test("accepts 20 pages and rejects larger or reversed ranges", () => {
        const parameters = new ParsePdfTool({parsePage: vi.fn()}).parameters;

        expect(parameters.safeParse({pdfPath: "../assets/file.pdf", pageNo: [1, 20]}).success).toBe(
            true
        );
        expect(parameters.safeParse({pdfPath: "../assets/file.pdf", pageNo: [1, 21]}).success).toBe(
            false
        );
        expect(parameters.safeParse({pdfPath: "../assets/file.pdf", pageNo: [2, 1]}).success).toBe(
            false
        );
        expect(parameters.safeParse({pdfPath: "../assets/file.txt", pageNo: [1, 1]}).success).toBe(
            false
        );
    });

    test("parses missing pages, stores Markdown, and returns deterministic filenames", async () => {
        const pdfBytes = await createPdf(3);
        const pdfHash = await getPdfSha256(pdfBytes);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(pdfBytes))
        );
        const parsePage = vi
            .fn<PdfMarkdownParser["parsePage"]>()
            .mockResolvedValueOnce("page two")
            .mockResolvedValueOnce("page three");

        const response = await new ParsePdfTool({parsePage}).execute({
            pdfPath: "../assets/file.pdf",
            pageNo: [2, 3]
        });

        const files = [`${pdfHash}-page-2.md`, `${pdfHash}-page-3.md`];
        expect(response.result).toEqual({
            success: true,
            result: `Parsed Pages stored in /home/user/anydoc-parse-results as: ${files.join(", ")}`
        });
        expect(parsePage).toHaveBeenCalledTimes(2);
        await expect(
            LogseqPluginStorageManager.getFileContent(AnyDocParseResultStore.groupName, files[0])
        ).resolves.toBe("page two");
        await expect(
            LogseqPluginStorageManager.getFileContent(AnyDocParseResultStore.groupName, files[1])
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
        const parsePage = vi.fn(async () => "new page");

        const response = await new ParsePdfTool({parsePage}).execute({
            pdfPath: "../assets/file.pdf",
            pageNo: [1, 2]
        });

        expect(response.result.success).toBe(true);
        expect(parsePage).toHaveBeenCalledTimes(1);
        await expect(
            LogseqPluginStorageManager.getFileContent(
                AnyDocParseResultStore.groupName,
                `${pdfHash}-page-1.md`
            )
        ).resolves.toBe("cached");
    });

    test("maps unsupported image-only pages to a focused error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(await createPdf(1)))
        );
        const error = Object.assign(new Error("no text"), {code: "unsupported"});

        const response = await new ParsePdfTool({
            parsePage: vi.fn(async () => Promise.reject(error))
        }).execute({pdfPath: "../assets/file.pdf", pageNo: [1, 1]});

        expect(response.result).toEqual({
            success: false,
            error: "Failed to parse PDF ../assets/file.pdf: AnyDoc could not extract text from PDF page 1. The page may be image-only or unsupported."
        });
    });
});
