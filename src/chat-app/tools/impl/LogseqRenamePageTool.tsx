import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {ChatToolResponse, type ToolResult} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    RenamePageCommand,
    type RenamePageCommandArgs,
    RenamePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRenamePageResult = ToolResult;

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
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RenamePageCommand(args));

            await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to rename Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
