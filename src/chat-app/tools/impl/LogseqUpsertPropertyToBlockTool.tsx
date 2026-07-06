import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    type LogseqReversibleTransactionResult,
    UpsertPropertyToBlockCommand,
    type UpsertPropertyToBlockCommandArgs,
    UpsertPropertyToBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqUpsertPropertyToBlockResult =
    | {
          success: true;
          block: LogseqReversibleTransactionResult;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqUpsertPropertyToBlockTool extends BaseChatToolWithDefaultUI<
    UpsertPropertyToBlockCommandArgs,
    LogseqUpsertPropertyToBlockResult
> {
    static readonly NAME = "logseq_upsert_property_to_block";

    readonly name = LogseqUpsertPropertyToBlockTool.NAME;
    readonly description =
        "Set a Logseq property value on a block by block UUID and property page UUID or property indent/key.";
    readonly parameters = UpsertPropertyToBlockCommandArgsSchema;

    async execute(
        args: UpsertPropertyToBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<
        LogseqUpsertPropertyToBlockResult | ToolResponse<LogseqUpsertPropertyToBlockResult>
    > {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new UpsertPropertyToBlockCommand(args));

            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, block},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to upsert Logseq block property on ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
