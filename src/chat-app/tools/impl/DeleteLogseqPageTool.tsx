import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {DeletePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const deleteLogseqPageParameters = z.object({
    pageIdentity: z.string().describe("Name or UUID of the Logseq page to delete.")
});

type DeleteLogseqPageArgs = z.infer<typeof deleteLogseqPageParameters>;

type DeleteLogseqPageResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class DeleteLogseqPageTool extends BaseChatToolWithDefaultUI<
    DeleteLogseqPageArgs,
    DeleteLogseqPageResult
> {
    static readonly NAME = "DeleteLogseqPage";

    readonly name = DeleteLogseqPageTool.NAME;
    readonly description = "Delete a Logseq page by name or UUID.";
    readonly parameters = deleteLogseqPageParameters;

    async execute(
        {pageIdentity}: DeleteLogseqPageArgs,
        context?: ChatToolExecutionContext
    ): Promise<DeleteLogseqPageResult | ToolResponse<DeleteLogseqPageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePageCommand(pageIdentity));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to delete Logseq page ${pageIdentity}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
