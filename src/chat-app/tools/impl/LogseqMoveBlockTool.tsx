import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    MoveBlockCommand,
    type MoveBlockCommandArgs,
    MoveBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqMoveBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

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
    ): Promise<LogseqMoveBlockResult | ToolResponse<LogseqMoveBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new MoveBlockCommand(args));

            await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to move Logseq block ${JSON.stringify(args.srcBlockUuid)}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
