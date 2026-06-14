import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    InsertBlockCommand,
    type InsertBlockCommandArgs,
    InsertBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";
import {createLogseqReversibleTransactionTrackerArtifact} from "../transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "../transaction/getLastLogseqReversibleTransactionTracker";

type LogseqInsertBlockResult =
    | {
          success: true;
          block: LogseqReversibleTransactionResult | undefined;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqInsertBlockTool extends BaseChatToolWithDefaultUI<
    InsertBlockCommandArgs,
    LogseqInsertBlockResult
> {
    static readonly NAME = "logseq_insert_block";

    readonly name = LogseqInsertBlockTool.NAME;
    readonly description = "Insert a Logseq block under a parent block or page by UUID.";
    readonly parameters = InsertBlockCommandArgsSchema;

    async execute(
        args: InsertBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqInsertBlockResult | ToolResponse<LogseqInsertBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new InsertBlockCommand(args));

            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, block},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to insert Logseq block under ${JSON.stringify(args.parentUuid)}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
