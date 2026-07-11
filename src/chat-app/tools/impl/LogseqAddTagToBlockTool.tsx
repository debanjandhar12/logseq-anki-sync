import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    AddTagToBlockCommand,
    type AddTagToBlockCommandArgs,
    AddTagToBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqAddTagToBlockResult =
    | {success: true; block: LogseqReversibleTransactionResult}
    | {success: false; error: string};

export class LogseqAddTagToBlockTool extends BaseChatToolWithDefaultUI<
    AddTagToBlockCommandArgs,
    LogseqAddTagToBlockResult
> {
    static readonly NAME = "logseq_add_tag_to_block";

    readonly name = LogseqAddTagToBlockTool.NAME;
    readonly description = "Add a Logseq tag to a block using block and tag page UUIDs.";
    readonly parameters = AddTagToBlockCommandArgsSchema;

    async execute(
        args: AddTagToBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqAddTagToBlockResult | ToolResponse<LogseqAddTagToBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new AddTagToBlockCommand(args));
            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, block},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to add tag ${args.tagPageUuid} to block ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
