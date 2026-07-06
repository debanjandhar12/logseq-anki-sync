import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    DeletePropertyFromBlockCommand,
    type DeletePropertyFromBlockCommandArgs,
    DeletePropertyFromBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDeletePropertyFromBlockResult =
    | {
          success: true;
          block: LogseqReversibleTransactionResult;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqDeletePropertyFromBlockTool extends BaseChatToolWithDefaultUI<
    DeletePropertyFromBlockCommandArgs,
    LogseqDeletePropertyFromBlockResult
> {
    static readonly NAME = "logseq_delete_property_from_block";

    readonly name = LogseqDeletePropertyFromBlockTool.NAME;
    readonly description =
        "Remove a Logseq property value from a block by block UUID and property page UUID or property indent/key.";
    readonly parameters = DeletePropertyFromBlockCommandArgsSchema;

    async execute(
        args: DeletePropertyFromBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<
        LogseqDeletePropertyFromBlockResult | ToolResponse<LogseqDeletePropertyFromBlockResult>
    > {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DeletePropertyFromBlockCommand(args));

            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, block},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to delete Logseq block property on ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
