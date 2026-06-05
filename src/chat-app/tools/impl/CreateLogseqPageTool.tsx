import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {LogseqTransactionResult} from "src/core/logseq-fakeable-transaction-tracker";
import {CreatePageCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

const createLogseqPageParameters = z.object({
    pageName: z.string().describe("Name of the Logseq page to create."),
    properties: z
        .record(z.string(), z.any())
        .optional()
        .describe("Optional Logseq page properties to set on the new page.")
});

type CreateLogseqPageArgs = z.infer<typeof createLogseqPageParameters>;

type CreateLogseqPageResult =
    | {
          success: true;
          page: LogseqTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class CreateLogseqPageTool extends BaseChatToolWithDefaultUI<
    CreateLogseqPageArgs,
    CreateLogseqPageResult
> {
    static readonly NAME = "CreateLogseqPage";

    readonly name = CreateLogseqPageTool.NAME;
    readonly description = "Create a Logseq page by name.";
    readonly parameters = createLogseqPageParameters;

    async execute(
        {pageName, properties}: CreateLogseqPageArgs,
        context?: ChatToolExecutionContext
    ): Promise<CreateLogseqPageResult | ToolResponse<CreateLogseqPageResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new CreatePageCommand(pageName, properties));

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
