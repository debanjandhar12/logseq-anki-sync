import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import {z} from "zod";

const JINA_READER_ENDPOINT = "https://r.jina.ai/";

const webPageGetParameters = z.object({
    url: z
        .string()
        .url()
        .describe("The absolute URL of the web page to read and extract content from.")
});

type WebPageGetArgs = z.infer<typeof webPageGetParameters>;

type WebPageGetResult = ChatToolSuccessResult<{url: string; content: string}> | ChatToolErrorResult;

export class WebPageGetTool extends BaseChatToolWithDefaultUI<WebPageGetArgs, WebPageGetResult> {
    static readonly NAME = "web_page_get";

    readonly name = WebPageGetTool.NAME;
    readonly description =
        "Fetches the readable text content of a web page using the Jina Reader API. " +
        "Use this when the user wants to read or summarize content from a specific URL.";
    readonly parameters = webPageGetParameters;

    async execute(
        {url}: WebPageGetArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<WebPageGetResult>> {
        try {
            const jinaApiKey = LogseqSettingAccessor.getPluginSettings().jinaApiKey;
            if (!jinaApiKey) {
                return ChatToolResponse.error(
                    "Jina AI API key is not configured. Please set the JINA_API_KEY setting to use web tools."
                );
            }

            const response = await fetch(`${JINA_READER_ENDPOINT}${url.trim()}`, {
                signal: context?.abortSignal,
                headers: {
                    Authorization: `Bearer ${jinaApiKey}`
                }
            });

            if (response.status !== 200) {
                return ChatToolResponse.error(
                    `Failed to fetch web page content from ${url} (status ${response.status}).`
                );
            }

            const content = await response.text();
            return ChatToolResponse.success({url, content});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to fetch web page ${url}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
