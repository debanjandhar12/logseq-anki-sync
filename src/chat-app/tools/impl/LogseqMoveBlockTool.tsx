import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {MoveBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const LogseqMoveBlockArgsZodObj = z.object({
    srcBlockUuid: z.string().describe("UUID of the Logseq block to move."),
    destBlockUuid: z.string().describe("UUID of the destination Logseq block.")
});

type LogseqMoveBlockArgs = z.infer<typeof LogseqMoveBlockArgsZodObj>;

type LogseqMoveBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqMoveBlockTool extends BaseChatToolWithDefaultUI<
    LogseqMoveBlockArgs,
    LogseqMoveBlockResult
> {
    static readonly NAME = "logseq_move_block";

    readonly name = LogseqMoveBlockTool.NAME;
    readonly description = "Move a Logseq block to a destination block by UUID.";
    readonly parameters = LogseqMoveBlockArgsZodObj;

    async execute(
        {srcBlockUuid, destBlockUuid}: LogseqMoveBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqMoveBlockResult | ToolResponse<LogseqMoveBlockResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new MoveBlockCommand(srcBlockUuid, destBlockUuid));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to move Logseq block ${srcBlockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
