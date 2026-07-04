import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    type LogseqReversibleTransactionResult,
    RestorePageCommand,
    type RestorePageCommandArgs,
    RestorePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRestorePageResult =
    | {
          success: true;
          page: LogseqReversibleTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqRestorePageTool extends BaseChatToolWithDefaultUI<
    RestorePageCommandArgs,
    LogseqRestorePageResult
> {
    static readonly NAME = "logseq_restore_page";

    readonly name = LogseqRestorePageTool.NAME;
    readonly description = "Restore a soft-deleted Logseq page by UUID.";
    readonly parameters = RestorePageCommandArgsSchema;

    async execute(
        args: RestorePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqRestorePageResult | ToolResponse<LogseqRestorePageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RestorePageCommand(args));

            const page = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, page},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to restore Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
