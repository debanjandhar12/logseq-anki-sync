import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ChatToolErrorResult,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
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
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new TextSearchCommand(args));

            const result = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {result},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to search Logseq text: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
