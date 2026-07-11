import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ToolErrorResult,
    type ToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
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
    | ToolSuccessResult<{page: LogseqReversibleTransactionResult | undefined}>
    | ToolErrorResult;

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
    ): Promise<ChatToolResponse<LogseqRestorePageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RestorePageCommand(args));

            const page = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {page},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to restore Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
