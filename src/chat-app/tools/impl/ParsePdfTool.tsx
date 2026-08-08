import type {ConvertErrorCode} from "@firecrawl/anydoc-wasm";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {CHAT_APP_AGENT_ANYDOC_MAX_PAGE_PARSE} from "src/constants";
import {anyDocPdfParser, type PdfMarkdownParser} from "src/core/anydoc/AnyDocPdfParser";
import {JUST_BASH_USER_HOME} from "src/core/just-bash-wrapper/types";
import {getPdfSha256} from "src/core/pdf/getPdfSha256";
import {PdfPageSplitter} from "src/core/pdf/PdfPageSplitter";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";

const parsePdfParameters = z.object({
    pdfPath: z
        .string()
        .trim()
        .min(1)
        .refine((path) => path.split(/[?#]/, 1)[0].toLowerCase().endsWith(".pdf"), {
            message: "pdfPath must point to a PDF file."
        })
        .describe("The Logseq asset path of the PDF to parse."),
    pageNo: z
        .tuple([z.number().int().positive(), z.number().int().positive()])
        .superRefine(([startPage, endPage], context) => {
            if (endPage < startPage) {
                context.addIssue({
                    code: "custom",
                    message: "The ending page must be greater than or equal to the starting page."
                });
                return;
            }
            if (endPage - startPage + 1 > CHAT_APP_AGENT_ANYDOC_MAX_PAGE_PARSE) {
                context.addIssue({
                    code: "custom",
                    message: `A PDF parse can include at most ${CHAT_APP_AGENT_ANYDOC_MAX_PAGE_PARSE} pages.`
                });
            }
        })
        .describe("Inclusive, 1-based page range as [startPage, endPage]. Use [n, n] for one page.")
});

type ParsePdfArgs = z.infer<typeof parsePdfParameters>;
type ParsePdfResult = ChatToolSuccessResult<{result: string}> | ChatToolErrorResult;

export class ParsePdfTool extends BaseChatToolWithDefaultUI<ParsePdfArgs, ParsePdfResult> {
    static readonly NAME = "parse_pdf";

    readonly name = ParsePdfTool.NAME;
    readonly description =
        `Parses up to ${CHAT_APP_AGENT_ANYDOC_MAX_PAGE_PARSE} pages from a PDF in the current Logseq graph into Markdown files. ` +
        "Use the PDF Path supplied with an attached Logseq PDF and request an inclusive page range. " +
        "Read the returned files with the bash tool.";
    readonly parameters = parsePdfParameters;

    constructor(private readonly pdfMarkdownParser: PdfMarkdownParser = anyDocPdfParser) {
        super();
    }

    async execute(
        {pdfPath, pageNo: [startPage, endPage]}: ParsePdfArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<ParsePdfResult>> {
        try {
            this.throwIfAborted(context?.abortSignal);
            const pdfBytes = await this.loadPdf(pdfPath, context?.abortSignal);
            const [pdfHash, preparedPages] = await Promise.all([
                getPdfSha256(pdfBytes),
                PdfPageSplitter.split(pdfBytes, startPage, endPage)
            ]);
            const files = preparedPages.map((page) => ({
                ...page,
                fileName: AnyDocParseResultStore.getFileName(pdfHash, page.pageNo)
            }));
            const cacheStatus = await Promise.all(
                files.map((page) => AnyDocParseResultStore.exists(pdfHash, page.pageNo))
            );
            const parsedPages: Array<{pageNo: number; markdown: string}> = [];

            for (const [index, page] of files.entries()) {
                if (cacheStatus[index]) continue;
                this.throwIfAborted(context?.abortSignal);
                try {
                    parsedPages.push({
                        pageNo: page.pageNo,
                        markdown: await this.pdfMarkdownParser.parsePage(page.bytes)
                    });
                } catch (error) {
                    throw new Error(this.getParseErrorMessage(page.pageNo, error));
                }
            }

            this.throwIfAborted(context?.abortSignal);
            for (const page of parsedPages) {
                try {
                    await AnyDocParseResultStore.save(pdfHash, page.pageNo, page.markdown);
                } catch (error) {
                    throw new Error(
                        `Failed to store parsed PDF page ${page.pageNo} as ${AnyDocParseResultStore.getFileName(pdfHash, page.pageNo)}: ${getErrorMessageFromErrObj(error)}`
                    );
                }
            }

            const storePath = `${JUST_BASH_USER_HOME}/${AnyDocParseResultStore.groupName}`;
            return ChatToolResponse.success({
                result: `Parsed Pages stored in ${storePath} as: ${files.map((file) => file.fileName).join(", ")}`
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return ChatToolResponse.error("PDF parsing was cancelled.");
            }
            return ChatToolResponse.error(
                `Failed to parse PDF ${pdfPath}: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }

    private async loadPdf(pdfPath: string, abortSignal?: AbortSignal): Promise<Uint8Array> {
        const assetUrl = await WindowParentBridge.makeAssetUrl(pdfPath);
        const response = await fetch(assetUrl, {signal: abortSignal});
        if (!response.ok) {
            throw new Error(`Unable to load the PDF (status ${response.status}).`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    private throwIfAborted(abortSignal?: AbortSignal): void {
        abortSignal?.throwIfAborted();
    }

    private getParseErrorMessage(pageNo: number, error: unknown): string {
        const code = (error as {code?: ConvertErrorCode} | null)?.code;
        switch (code) {
            case "unsupported":
                return `AnyDoc could not extract text from PDF page ${pageNo}. The page may be image-only or unsupported.`;
            case "encrypted":
                return `PDF page ${pageNo} could not be parsed because the PDF is encrypted or password-protected.`;
            case "malformed":
                return `PDF page ${pageNo} is structurally malformed and could not be converted.`;
            case "resourceLimit":
                return `PDF page ${pageNo} exceeded AnyDoc's conversion safety limits.`;
            case "missingPart":
                return `PDF page ${pageNo} is missing data required for conversion.`;
            default:
                return `Failed to parse PDF page ${pageNo}: ${getErrorMessageFromErrObj(error)}`;
        }
    }
}
