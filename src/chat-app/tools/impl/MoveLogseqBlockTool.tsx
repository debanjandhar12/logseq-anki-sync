import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {MoveBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const moveLogseqBlockParameters = z.object({
    srcBlockUuid: z.string().describe("UUID of the Logseq block to move."),
    destBlockUuid: z.string().describe("UUID of the destination Logseq block.")
});

type MoveLogseqBlockArgs = z.infer<typeof moveLogseqBlockParameters>;

type MoveLogseqBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class MoveLogseqBlockTool extends BaseChatToolWithDefaultUI<
    MoveLogseqBlockArgs,
    MoveLogseqBlockResult
> {
    static readonly NAME = "MoveLogseqBlock";

    readonly name = MoveLogseqBlockTool.NAME;
    readonly description = "Move a Logseq block to a destination block by UUID.";
    readonly parameters = moveLogseqBlockParameters;

    async execute(
        {srcBlockUuid, destBlockUuid}: MoveLogseqBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<MoveLogseqBlockResult | ToolResponse<MoveLogseqBlockResult>> {
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
