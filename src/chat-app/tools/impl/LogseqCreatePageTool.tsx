import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {LogseqTransactionResult} from "src/core/logseq-fakeable-transaction-tracker";
import {CreatePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const LogseqCreatePageArgsZodObj = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

type LogseqCreatePageArgs = z.infer<typeof LogseqCreatePageArgsZodObj>;

type LogseqCreatePageResult =
    | {
          success: true;
          page: LogseqTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqCreatePageTool extends BaseChatToolWithDefaultUI<
    LogseqCreatePageArgs,
    LogseqCreatePageResult
> {
    static readonly NAME = "logseq_create_page";

    readonly name = LogseqCreatePageTool.NAME;
    readonly description = "Create a Logseq page by name.";
    readonly parameters = LogseqCreatePageArgsZodObj;

    async execute(
        {pageName}: LogseqCreatePageArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqCreatePageResult | ToolResponse<LogseqCreatePageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new CreatePageCommand(pageName));

            const executor = await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true, page: executor.getLastResult()},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to create Logseq page ${pageName}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
