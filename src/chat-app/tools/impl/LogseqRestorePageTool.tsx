import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {executeLogseqReversibleCommand} from "src/chat-app/tools/transaction/executeLogseqReversibleCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    type LogseqReversibleTransactionResult,
    RestorePageCommand,
    type RestorePageCommandArgs,
    RestorePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRestorePageResult =
    | ChatToolSuccessResult<{page: LogseqReversibleTransactionResult | undefined}>
    | ChatToolErrorResult;

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
            const {result: page, tracker} = await executeLogseqReversibleCommand({
                command: new RestorePageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {page},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to restore Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
