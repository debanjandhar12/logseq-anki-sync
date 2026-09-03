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

const JINA_SEARCH_ENDPOINT = "https://s.jina.ai/";

const webSearchParameters = z.object({
    query: z.string().describe("The search query to look up on the web.")
});

type WebSearchArgs = z.infer<typeof webSearchParameters>;

type WebSearchResult =
    | ChatToolSuccessResult<{query: string; content: string}>
    | ChatToolErrorResult;

export class WebSearchTool extends BaseChatToolWithDefaultUI<WebSearchArgs, WebSearchResult> {
    static readonly NAME = "web_search";

    readonly name = WebSearchTool.NAME;
    readonly description =
        "Searches the web for a query using the Jina Search API and returns the " +
        "aggregated search result content. Use this to find up-to-date information from the internet.";
    readonly parameters = webSearchParameters;

    async execute(
        {query}: WebSearchArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<WebSearchResult>> {
        try {
            const jinaApiKey = LogseqSettingAccessor.getPluginSettings().jinaApiKey?.trim();
            if (!jinaApiKey) {
                return ChatToolResponse.error(
                    "Jina AI API key is not configured. Please set the Jina AI API Key setting to use web tools."
                );
            }

            const response = await fetch(
                `${JINA_SEARCH_ENDPOINT}?q=${encodeURIComponent(query.trim())}`,
                {
                    signal: context?.abortSignal,
                    headers: {
                        Authorization: `Bearer ${jinaApiKey}`
                    }
                }
            );

            if (response.status !== 200) {
                return ChatToolResponse.error(
                    `Failed to search the web for "${query}" (status ${response.status}).`
                );
            }

            const content = await response.text();
            return ChatToolResponse.success({query, content});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to search the web for "${query}": ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
