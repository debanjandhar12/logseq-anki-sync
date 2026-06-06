import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {DeletePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const LogseqDeletePageArgsZodObj = z.object({
    pageUuid: z.string().describe("UUID of the Logseq page to delete.")
});

type LogseqDeletePageArgs = z.infer<typeof LogseqDeletePageArgsZodObj>;

type LogseqDeletePageResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqDeletePageTool extends BaseChatToolWithDefaultUI<
    LogseqDeletePageArgs,
    LogseqDeletePageResult
> {
    static readonly NAME = "logseq_delete_page";

    readonly name = LogseqDeletePageTool.NAME;
    readonly description = "Delete a Logseq page by name or UUID.";
    readonly parameters = LogseqDeletePageArgsZodObj;

    async execute(
        {pageUuid}: LogseqDeletePageArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqDeletePageResult | ToolResponse<LogseqDeletePageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePageCommand(pageUuid));

            await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to delete Logseq page ${pageUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
