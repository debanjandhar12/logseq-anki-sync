import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {ChatToolResponse, type ToolResult} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    UpdateBlockCommand,
    type UpdateBlockCommandArgs,
    UpdateBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqUpdateBlockResult = ToolResult;

export class LogseqUpdateBlockTool extends BaseChatToolWithDefaultUI<
    UpdateBlockCommandArgs,
    LogseqUpdateBlockResult
> {
    static readonly NAME = "logseq_update_block";

    readonly name = LogseqUpdateBlockTool.NAME;
    readonly description = "Update a Logseq block by UUID.";
    readonly parameters = UpdateBlockCommandArgsSchema;

    async execute(
        args: UpdateBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqUpdateBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new UpdateBlockCommand(args));

            await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to update Logseq block ${JSON.stringify(args.blockUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
