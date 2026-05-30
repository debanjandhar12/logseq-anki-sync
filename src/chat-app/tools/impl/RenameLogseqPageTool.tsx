import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {RenamePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const renameLogseqPageParameters = z.object({
    pageIdentity: z.string().describe("Current name or UUID of the Logseq page to rename."),
    newName: z.string().describe("New name for the Logseq page.")
});

type RenameLogseqPageArgs = z.infer<typeof renameLogseqPageParameters>;

type RenameLogseqPageResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class RenameLogseqPageTool extends BaseChatToolWithDefaultUI<
    RenameLogseqPageArgs,
    RenameLogseqPageResult
> {
    static readonly NAME = "RenameLogseqPage";

    readonly name = RenameLogseqPageTool.NAME;
    readonly description = "Rename a Logseq page by name or UUID.";
    readonly parameters = renameLogseqPageParameters;

    async execute(
        {pageIdentity, newName}: RenameLogseqPageArgs,
        context?: ChatToolExecutionContext
    ): Promise<RenameLogseqPageResult | ToolResponse<RenameLogseqPageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RenamePageCommand(pageIdentity, newName));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to rename Logseq page ${pageIdentity}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
