import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ChatToolErrorResult,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
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
    | ChatToolSuccessResult<{block: LogseqReversibleTransactionResult}>
    | ChatToolErrorResult;

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
    ): Promise<ChatToolResponse<LogseqAddTagToBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new AddTagToBlockCommand(args));
            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {block},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to add tag ${args.tagPageUuid} to block ${args.blockUuid}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
