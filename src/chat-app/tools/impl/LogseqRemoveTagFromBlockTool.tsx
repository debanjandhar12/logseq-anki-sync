import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    type LogseqReversibleTransactionResult,
    RemoveTagFromBlockCommand,
    type RemoveTagFromBlockCommandArgs,
    RemoveTagFromBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRemoveTagFromBlockResult =
    | {success: true; block: LogseqReversibleTransactionResult}
    | {success: false; error: string};

export class LogseqRemoveTagFromBlockTool extends BaseChatToolWithDefaultUI<
    RemoveTagFromBlockCommandArgs,
    LogseqRemoveTagFromBlockResult
> {
    static readonly NAME = "logseq_remove_tag_from_block";

    readonly name = LogseqRemoveTagFromBlockTool.NAME;
    readonly description = "Remove a Logseq tag from a block using block and tag page UUIDs.";
    readonly parameters = RemoveTagFromBlockCommandArgsSchema;

    async execute(
        args: RemoveTagFromBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqRemoveTagFromBlockResult | ToolResponse<LogseqRemoveTagFromBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RemoveTagFromBlockCommand(args));
            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, block},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to remove tag ${args.tagPageUuid} from block ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
