import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {UpdateBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const updateLogseqBlockParameters = z.object({
    blockUuid: z.string().describe("UUID of the Logseq block to update."),
    content: z.string().describe("New content for the Logseq block.")
});

type UpdateLogseqBlockArgs = z.infer<typeof updateLogseqBlockParameters>;

type UpdateLogseqBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class UpdateLogseqBlockTool extends BaseChatToolWithDefaultUI<
    UpdateLogseqBlockArgs,
    UpdateLogseqBlockResult
> {
    static readonly NAME = "update_logseq_block";

    readonly name = UpdateLogseqBlockTool.NAME;
    readonly description = "Update a Logseq block by UUID.";
    readonly parameters = updateLogseqBlockParameters;

    async execute(
        {blockUuid, content}: UpdateLogseqBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<UpdateLogseqBlockResult | ToolResponse<UpdateLogseqBlockResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new UpdateBlockCommand(blockUuid, content));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to update Logseq block ${blockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
