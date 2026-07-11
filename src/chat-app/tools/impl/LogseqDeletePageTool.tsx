import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {ChatToolResponse, type ToolResult} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    DeletePageCommand,
    type DeletePageCommandArgs,
    DeletePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDeletePageResult = ToolResult;

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
    ): Promise<ChatToolResponse<LogseqDeletePageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePageCommand(args));

            await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to delete Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
