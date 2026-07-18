import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {addAndExecLogseqReversibleCommand} from "src/chat-app/tools/transaction/addAndExecLogseqReversibleCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    MoveBlockCommand,
    type MoveBlockCommandArgs,
    MoveBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqMoveBlockResult = ChatToolSuccessResult | ChatToolErrorResult;

export class LogseqMoveBlockTool extends BaseChatToolWithDefaultUI<
    MoveBlockCommandArgs,
    LogseqMoveBlockResult
> {
    static readonly NAME = "logseq_move_block";

    readonly name = LogseqMoveBlockTool.NAME;
    readonly description = "Move a Logseq block to a destination block by UUID.";
    readonly parameters = MoveBlockCommandArgsSchema;

    async execute(
        args: MoveBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqMoveBlockResult>> {
        try {
            const {tracker} = await addAndExecLogseqReversibleCommand({
                command: new MoveBlockCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to move Logseq block ${JSON.stringify(args.srcBlockUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
