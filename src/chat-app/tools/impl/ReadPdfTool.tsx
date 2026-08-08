import {AuthenticationError, LlamaCloud, toFile} from "@llamaindex/llama-cloud";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {PdfPageSplitter, type PreparedPdfPage} from "src/core/pdf/PdfPageSplitter";
import {LlamaCloudParseResultStore} from "src/core/stores/llama-cloud-parse-result-store/LlamaCloudParseResultStore";
import type {LlamaCloudParseResultData} from "src/core/stores/llama-cloud-parse-result-store/types";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";

const MAX_PAGES_PER_REQUEST = 7;

const readPdfParameters = z.object({
    pdfPath: z
        .string()
        .trim()
        .min(1)
        .refine((path) => path.split(/[?#]/, 1)[0].toLowerCase().endsWith(".pdf"), {
            message: "pdfPath must point to a PDF file."
        })
        .describe("The Logseq asset path of the PDF to read."),
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
            if (endPage - startPage + 1 > MAX_PAGES_PER_REQUEST) {
                context.addIssue({
                    code: "custom",
                    message: `A PDF read can include at most ${MAX_PAGES_PER_REQUEST} pages.`
                });
            }
        })
        .describe("Inclusive, 1-based page range as [startPage, endPage]. Use [n, n] for one page.")
});

type ReadPdfArgs = z.infer<typeof readPdfParameters>;
type ReadPdfPageResult = {pageNo: number; content: string};
type ReadPdfResult =
    | ChatToolSuccessResult<{
          pdfPath: string;
          startPage: number;
          endPage: number;
          pages: ReadPdfPageResult[];
      }>
    | ChatToolErrorResult;

export class ReadPdfTool extends BaseChatToolWithDefaultUI<ReadPdfArgs, ReadPdfResult> {
    static readonly NAME = "read_pdf";

    readonly name = ReadPdfTool.NAME;
    readonly description =
        "Reads one to seven pages from a PDF in the current Logseq graph. " +
        "Use the PDF Path supplied with an attached Logseq PDF and request an inclusive page range.";
    readonly parameters = readPdfParameters;

    async execute(
        {pdfPath, pageNo: [startPage, endPage]}: ReadPdfArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<ReadPdfResult>> {
        try {
            const settings = LogseqSettingAccessor.getPluginSettings();
            const pdfBytes = await this.loadPdf(pdfPath, context?.abortSignal);
            const preparedPages = await PdfPageSplitter.split(
                pdfBytes,
                startPage,
                endPage,
                this.getPdfFileName(pdfPath)
            );
            const parsedPagesByPageNo = new Map<number, LlamaCloudParseResultData>();
            const cacheMisses: PreparedPdfPage[] = [];

            for (const preparedPage of preparedPages) {
                const cachedPage = await LlamaCloudParseResultStore.get(preparedPage.hash);
                if (cachedPage) {
                    parsedPagesByPageNo.set(preparedPage.pageNo, cachedPage);
                } else {
                    cacheMisses.push(preparedPage);
                }
            }

            if (cacheMisses.length > 0) {
                const llamaCloudApiKey = settings.llamaCloudApiKey?.trim();
                if (!llamaCloudApiKey) {
                    return ChatToolResponse.error(
                        "LlamaCloud API key is not configured. Set it in Content Parsing (Pdf) settings."
                    );
                }

                const llamaCloud = new LlamaCloud({apiKey: llamaCloudApiKey});
                for (const preparedPage of cacheMisses) {
                    const result = await llamaCloud.parsing.parse(
                        {
                            upload_file: await toFile(preparedPage.bytes, preparedPage.fileName, {
                                type: "application/pdf"
                            }),
                            tier: "agentic",
                            version: "latest",
                            processing_options: {
                                cost_optimizer: {enable: true}
                            },
                            expand: ["markdown", "items"]
                        },
                        {
                            signal: context?.abortSignal,
                            timeout: 10 * 60
                        }
                    );
                    const markdownPage = result.markdown?.pages.find(
                        (page) => page.page_number === 1
                    );
                    const itemsPage = result.items?.pages.find((page) => page.page_number === 1);
                    if (!markdownPage || markdownPage.success === false) {
                        throw new Error(
                            `LlamaCloud did not return markdown for ${preparedPage.fileName}.`
                        );
                    }
                    if (!itemsPage || itemsPage.success === false) {
                        throw new Error(
                            `LlamaCloud did not return items for ${preparedPage.fileName}.`
                        );
                    }

                    const storedPage: LlamaCloudParseResultData = {
                        version: 1,
                        items: itemsPage.items as unknown as Array<Record<string, unknown>>,
                        content: markdownPage.markdown
                    };
                    await LlamaCloudParseResultStore.save(preparedPage.hash, storedPage);
                    parsedPagesByPageNo.set(preparedPage.pageNo, storedPage);
                }
            }

            const pageResults: ReadPdfPageResult[] = preparedPages.map((page) => {
                const parsedPage = parsedPagesByPageNo.get(page.pageNo);
                if (!parsedPage) throw new Error(`Missing parsed PDF page ${page.pageNo}.`);
                return {pageNo: page.pageNo, content: parsedPage.content};
            });

            return ChatToolResponse.success({
                pdfPath,
                startPage,
                endPage,
                pages: pageResults
            });
        } catch (error) {
            if (error instanceof AuthenticationError) {
                return ChatToolResponse.error(
                    "LlamaCloud rejected the configured API key. Verify the key in Content Parsing (Pdf)."
                );
            }
            return ChatToolResponse.error(
                `Failed to read PDF ${pdfPath}: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }

    private async loadPdf(pdfPath: string, abortSignal?: AbortSignal): Promise<Uint8Array> {
        const assetUrl = await WindowParentBridge.makeAssetUrl(pdfPath);
        const response = await fetch(assetUrl, {signal: abortSignal});
        if (!response.ok) {
            throw new Error(`Unable to load the PDF (status ${response.status}).`);
        }
        // Normalize the response before handing binary data to pdf-lib.
        return new Uint8Array(await response.arrayBuffer());
    }

    private getPdfFileName(pdfPath: string): string {
        return pdfPath.split(/[\\/]/).at(-1)?.split(/[?#]/, 1)[0] || "document.pdf";
    }
}
