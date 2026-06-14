import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    DeletePageCommand,
    type DeletePageCommandArgs,
    DeletePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDeletePageResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqDeletePageTool extends BaseChatToolWithDefaultUI<
    DeletePageCommandArgs,
    LogseqDeletePageResult
> {
    static readonly NAME = "logseq_delete_page";

    readonly name = LogseqDeletePageTool.NAME;
    readonly description = "Delete a Logseq page by name or UUID.";
    readonly parameters = DeletePageCommandArgsSchema;

    async execute(
        args: DeletePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqDeletePageResult | ToolResponse<LogseqDeletePageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePageCommand(args));

            await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to delete Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
