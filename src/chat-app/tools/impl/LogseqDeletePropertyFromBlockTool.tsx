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
    DeletePropertyFromBlockCommand,
    type DeletePropertyFromBlockCommandArgs,
    DeletePropertyFromBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDeletePropertyFromBlockResult =
    | ToolSuccessResult<{block: LogseqReversibleTransactionResult}>
    | ToolErrorResult;

export class LogseqDeletePropertyFromBlockTool extends BaseChatToolWithDefaultUI<
    DeletePropertyFromBlockCommandArgs,
    LogseqDeletePropertyFromBlockResult
> {
    static readonly NAME = "logseq_delete_property_from_block";

    readonly name = LogseqDeletePropertyFromBlockTool.NAME;
    readonly description =
        "Remove a Logseq property value from a block by block UUID and property page UUID or property indent/key.";
    readonly parameters = DeletePropertyFromBlockCommandArgsSchema;

    async execute(
        args: DeletePropertyFromBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqDeletePropertyFromBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePropertyFromBlockCommand(args));

            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {block},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to delete Logseq block property on ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
