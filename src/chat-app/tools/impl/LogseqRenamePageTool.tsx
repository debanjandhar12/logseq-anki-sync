import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {addAndExecLogseqReversibleCommand} from "src/chat-app/tools/transaction/addAndExecLogseqReversibleCommand";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getTrackerArtifactFromError} from "src/chat-app/tools/transaction/getTrackerArtifactFromError";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    RenamePageCommand,
    type RenamePageCommandArgs,
    RenamePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRenamePageResult = ChatToolSuccessResult | ChatToolErrorResult;

export class LogseqRenamePageTool extends BaseChatToolWithDefaultUI<
    RenamePageCommandArgs,
    LogseqRenamePageResult
> {
    static readonly NAME = "logseq_rename_page";

    readonly name = LogseqRenamePageTool.NAME;
    readonly description = "Rename a Logseq page by name or UUID.";
    readonly parameters = RenamePageCommandArgsSchema;

    async execute(
        args: RenamePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqRenamePageResult>> {
        try {
            const {tracker} = await addAndExecLogseqReversibleCommand({
                command: new RenamePageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to rename Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`,
                getTrackerArtifactFromError(err)
            );
        }
    }
}
