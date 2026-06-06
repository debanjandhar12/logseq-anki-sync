import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {UpdateBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const LogseqUpdateBlockArgsZodObj = z.object({
    blockUuid: z.string().describe("UUID of the Logseq block to update."),
    content: z.string().describe("New content for the Logseq block.")
});

type LogseqUpdateBlockArgs = z.infer<typeof LogseqUpdateBlockArgsZodObj>;

type LogseqUpdateBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqUpdateBlockTool extends BaseChatToolWithDefaultUI<
    LogseqUpdateBlockArgs,
    LogseqUpdateBlockResult
> {
    static readonly NAME = "logseq_update_block";

    readonly name = LogseqUpdateBlockTool.NAME;
    readonly description = "Update a Logseq block by UUID.";
    readonly parameters = LogseqUpdateBlockArgsZodObj;

    async execute(
        {blockUuid, content}: LogseqUpdateBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqUpdateBlockResult | ToolResponse<LogseqUpdateBlockResult>> {
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
