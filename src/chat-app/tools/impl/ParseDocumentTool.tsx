import type {ConvertErrorCode} from "@firecrawl/anydoc-wasm";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD, VIR_ENV_USER_PATH} from "src/constants";
import {
    AnyDocInitializationError,
    AnyDocParser,
    EpubPageSplitter,
    getDocumentFormat,
    getFileSha256,
    PdfPageSplitter
} from "src/core/anydoc";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";

const PAGE_PARSE_FAILURE_MARKER = "<!-- ANYDOC_PAGE_PARSE_FAILED -->";
const LEGACY_PDF_PAGE_PARSE_FAILURE_MARKER = "<!-- PDF_PAGE_PARSE_FAILED -->";

const parseDocumentParameters = z.object({
    documentPath: z
        .string()
        .trim()
        .min(1)
        .refine((path) => getDocumentFormat(path) !== undefined, {
            message: "documentPath must point to a PDF or EPUB file."
        })
        .describe("The Logseq asset path of the PDF or EPUB to parse.")
});

type ParseDocumentArgs = z.infer<typeof parseDocumentParameters>;
type ParseDocumentResult = ChatToolSuccessResult<{result: string}> | ChatToolErrorResult;

export class ParseDocumentTool extends BaseChatToolWithDefaultUI<
    ParseDocumentArgs,
    ParseDocumentResult
> {
    static readonly NAME = "parse_document";

    readonly name = ParseDocumentTool.NAME;
    readonly description =
        "Parses all pages from a PDF / Epub into separate Markdown files. " +
        "Read the returned files with the bash tool.";
    readonly parameters = parseDocumentParameters;

    async execute(
        args: ParseDocumentArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<ParseDocumentResult>> {
        const abortSignal = context?.abortSignal;
        let documentLabel = "document";
        try {
            abortSignal?.throwIfAborted();
            const {documentPath} = this.parameters.parse(args);
            const format = getDocumentFormat(documentPath)!;
            documentLabel = format.toUpperCase();
            const assetUrl = await WindowParentBridge.makeAssetUrl(documentPath);
            const response = await fetch(assetUrl, {signal: abortSignal});
            if (!response.ok)
                throw new Error(`Unable to load the ${documentLabel} (status ${response.status}).`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            abortSignal?.throwIfAborted();
            const fileHash = await getFileSha256(bytes);
            const storedPages = new Map(
                (await AnyDocParseResultStore.getPages(fileHash)).map((page) => [
                    page.pageNo,
                    page.content
                ])
            );
            const pages =
                format === "pdf"
                    ? PdfPageSplitter.split(bytes, abortSignal)
                    : EpubPageSplitter.split(bytes, abortSignal);
            let pageCount = 0;
            let failedPageCount = 0;
            for await (const page of pages) {
                abortSignal?.throwIfAborted();
                pageCount++;
                const cached = storedPages.get(page.pageNo);
                if (cached !== undefined) {
                    if (this.isParseFailure(cached)) failedPageCount++;
                    continue;
                }
                let markdown: string;
                try {
                    markdown =
                        format === "pdf"
                            ? await AnyDocParser.parsePdfPage(page.bytes)
                            : await AnyDocParser.parseEpubPage(page.bytes);
                } catch (error) {
                    abortSignal?.throwIfAborted();
                    if (this.isAbortError(error) || error instanceof AnyDocInitializationError)
                        throw error;
                    failedPageCount++;
                    markdown = `${PAGE_PARSE_FAILURE_MARKER}\n# ${documentLabel} page parsing failed\n\nParsing failed for page ${page.pageNo}.\n\nError: ${this.getParseErrorMessage(documentLabel, page.pageNo, error)}`;
                }
                abortSignal?.throwIfAborted();
                try {
                    await AnyDocParseResultStore.save(fileHash, page.pageNo, markdown);
                } catch (error) {
                    throw new Error(
                        `Failed to store parsed ${documentLabel} page ${page.pageNo} as ${AnyDocParseResultStore.getFileName(fileHash, page.pageNo)}: ${getErrorMessageFromErrObj(error)}`
                    );
                }
            }
            abortSignal?.throwIfAborted();
            if (pageCount === 0) throw new Error(`The ${documentLabel} contains no pages.`);
            const failedPageRatio = failedPageCount / pageCount;
            if (failedPageRatio > CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD) {
                throw new Error(
                    `${documentLabel} parsing failed for ${failedPageCount} of ${pageCount} pages (${Math.round(failedPageRatio * 100)}%), exceeding the allowed ${CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD * 100}% page-error threshold.`
                );
            }
            const storePath = `${VIR_ENV_USER_PATH}/${AnyDocParseResultStore.groupName}`;
            return ChatToolResponse.success({
                result: `Parsed pages stored in ${storePath} as: ${fileHash}-page-<page no/logical spine>.md. Use bash to list / search the pages and read the relevant context.`
            });
        } catch (error) {
            if (abortSignal?.aborted || this.isAbortError(error)) {
                return ChatToolResponse.error(`${documentLabel} parsing was cancelled.`);
            }
            return ChatToolResponse.error(
                `Failed to parse ${documentLabel} ${args.documentPath}: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }

    private isAbortError(error: unknown): boolean {
        return error instanceof DOMException && error.name === "AbortError";
    }

    private isParseFailure(content: string): boolean {
        return (
            content.startsWith(PAGE_PARSE_FAILURE_MARKER) ||
            content.startsWith(LEGACY_PDF_PAGE_PARSE_FAILURE_MARKER)
        );
    }

    private getParseErrorMessage(label: string, pageNo: number, error: unknown): string {
        const page = `${label} page ${pageNo}`;
        const code = (error as {code?: ConvertErrorCode | "io"} | null)?.code;
        switch (code) {
            case "unsupported":
                return `AnyDoc could not extract text from ${page}. ${label === "PDF" ? "The page may be image-only or unsupported." : "The section may be unsupported."}`;
            case "encrypted":
                return `${page} could not be parsed because the ${label} is encrypted or password-protected.`;
            case "malformed":
                return `${page} is structurally malformed and could not be converted.`;
            case "resourceLimit":
                return `${page} exceeded AnyDoc's conversion safety limits.`;
            case "missingPart":
                return `${page} is missing data required for conversion.`;
            case "io":
                return `${page} could not be parsed because of an input/output error.`;
            default:
                return `Failed to parse ${page}: ${getErrorMessageFromErrObj(error)}`;
        }
    }
}
