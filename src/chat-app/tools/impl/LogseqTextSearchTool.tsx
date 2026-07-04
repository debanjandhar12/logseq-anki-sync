import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    TextSearchCommand,
    type TextSearchCommandArgs,
    TextSearchCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqTextSearchResult =
    | {
          success: true;
          result: unknown;
      }
    | {
          success: false;
          error: string;
      };

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
    ): Promise<LogseqTextSearchResult | ToolResponse<LogseqTextSearchResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new TextSearchCommand(args));

            const result = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, result},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to search Logseq text: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
