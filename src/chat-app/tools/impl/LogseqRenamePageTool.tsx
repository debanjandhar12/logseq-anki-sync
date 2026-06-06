import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {RenamePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const LogseqRenamePageArgsZodObj = z.object({
    pageUuid: z.string().describe("Current name or UUID of the Logseq page to rename."),
    newName: z.string().describe("New name for the Logseq page.")
});

type LogseqRenamePageArgs = z.infer<typeof LogseqRenamePageArgsZodObj>;

type LogseqRenamePageResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqRenamePageTool extends BaseChatToolWithDefaultUI<
    LogseqRenamePageArgs,
    LogseqRenamePageResult
> {
    static readonly NAME = "logseq_rename_page";

    readonly name = LogseqRenamePageTool.NAME;
    readonly description = "Rename a Logseq page by name or UUID.";
    readonly parameters = LogseqRenamePageArgsZodObj;

    async execute(
        {pageUuid, newName}: LogseqRenamePageArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqRenamePageResult | ToolResponse<LogseqRenamePageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RenamePageCommand(pageUuid, newName));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to rename Logseq page ${pageUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
