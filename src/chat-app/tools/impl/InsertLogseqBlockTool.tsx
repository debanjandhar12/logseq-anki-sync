import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {LogseqTransactionResult} from "src/core/logseq-fakeable-transaction-tracker";
import {InsertBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";
import {createLogseqFakeableTransactionTrackerArtifact} from "../transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "../transaction/getLastLogseqFakeableTransactionTracker";

const insertLogseqBlockParameters = z.object({
    parentUuid: z.string().describe("UUID of the parent Logseq block or page."),
    content: z.string().describe("Content to insert into the new Logseq block.")
});

type InsertLogseqBlockArgs = z.infer<typeof insertLogseqBlockParameters>;

type InsertLogseqBlockResult =
    | {
          success: true;
          block: LogseqTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class InsertLogseqBlockTool extends BaseChatToolWithDefaultUI<
    InsertLogseqBlockArgs,
    InsertLogseqBlockResult
> {
    static readonly NAME = "InsertLogseqBlock";

    readonly name = InsertLogseqBlockTool.NAME;
    readonly description = "Insert a Logseq block under a parent block or page by UUID.";
    readonly parameters = insertLogseqBlockParameters;

    async execute(
        {parentUuid, content}: InsertLogseqBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<InsertLogseqBlockResult | ToolResponse<InsertLogseqBlockResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(new InsertBlockCommand(parentUuid, content));

            const executor = await transactionTracker.executeInTheInMemoryDB();

            return new ToolResponse({
                result: {success: true, block: executor.getLastResult()},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to insert Logseq block under ${parentUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
