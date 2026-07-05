import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    ReadBlockCommand,
    type ReadBlockCommandArgs,
    ReadBlockCommandArgsSchema,
    type ReadBlockCommandResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqReadBlockResult =
    | {
          success: true;
          type: ReadBlockCommandResult["type"];
          block: ReadBlockCommandResult["block"];
      }
    | {
          success: false;
          error: string;
      };

export class LogseqReadBlockTool extends BaseChatToolWithDefaultUI<
    ReadBlockCommandArgs,
    LogseqReadBlockResult
> {
    static readonly NAME = "logseq_read_block";

    readonly name = LogseqReadBlockTool.NAME;
    readonly description = "Read a Logseq block, page, tag page, or property page by UUID.";
    readonly parameters = ReadBlockCommandArgsSchema;

    async execute(
        args: ReadBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqReadBlockResult | ToolResponse<LogseqReadBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new ReadBlockCommand(args));

            const result = (await transactionTracker.execute()) as ReadBlockCommandResult;
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, ...result},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to read Logseq block ${args.uuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
