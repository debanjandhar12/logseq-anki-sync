import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {execLogseqReadOnlyCommand} from "src/chat-app/tools/transaction/execLogseqReadOnlyCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    TextSearchCommand,
    type TextSearchCommandArgs,
    TextSearchCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqTextSearchResult = ChatToolSuccessResult<{result: unknown}> | ChatToolErrorResult;

/**
 * TODO: logseq.api.search likely supports pagination so need to add support for it.
 */
export class LogseqTextSearchTool extends BaseChatToolWithDefaultUI<
    TextSearchCommandArgs,
    LogseqTextSearchResult
> {
    static readonly NAME = "logseq_text_search";

    readonly name = LogseqTextSearchTool.NAME;
    readonly description = "Search Logseq for pages and blocks matching a text string.";
    readonly parameters = TextSearchCommandArgsSchema;

    async execute(
        args: TextSearchCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqTextSearchResult>> {
        try {
            const result = await execLogseqReadOnlyCommand(new TextSearchCommand(args), {
                signal: context?.abortSignal
            });

            return ChatToolResponse.success({result});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to search Logseq text: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
