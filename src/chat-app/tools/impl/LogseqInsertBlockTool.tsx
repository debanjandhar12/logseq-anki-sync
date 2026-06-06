import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {LogseqTransactionResult} from "src/core/logseq-fakeable-transaction-tracker";
import {InsertBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";
import {createLogseqFakeableTransactionTrackerArtifact} from "../transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "../transaction/getLastLogseqFakeableTransactionTracker";

const LogseqInsertBlockArgsZodObj = z.object({
    parentUuid: z.string().describe("UUID of the parent Logseq block or page."),
    content: z.string().describe("Content to insert into the new Logseq block.")
});

type LogseqInsertBlockArgs = z.infer<typeof LogseqInsertBlockArgsZodObj>;

type LogseqInsertBlockResult =
    | {
          success: true;
          block: LogseqTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqInsertBlockTool extends BaseChatToolWithDefaultUI<
    LogseqInsertBlockArgs,
    LogseqInsertBlockResult
> {
    static readonly NAME = "logseq_insert_block";

    readonly name = LogseqInsertBlockTool.NAME;
    readonly description = "Insert a Logseq block under a parent block or page by UUID.";
    readonly parameters = LogseqInsertBlockArgsZodObj;

    async execute(
        {parentUuid, content}: LogseqInsertBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqInsertBlockResult | ToolResponse<LogseqInsertBlockResult>> {
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
