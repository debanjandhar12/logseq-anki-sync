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
    type LogseqReversibleTransactionResult,
    RemovePropertyFromTagPageCommand,
    type RemovePropertyFromTagPageCommandArgs,
    RemovePropertyFromTagPageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqRemovePropertyFromTagPageResult =
    | ChatToolSuccessResult<{tag: LogseqReversibleTransactionResult}>
    | ChatToolErrorResult;

export class LogseqRemovePropertyFromTagPageTool extends BaseChatToolWithDefaultUI<
    RemovePropertyFromTagPageCommandArgs,
    LogseqRemovePropertyFromTagPageResult
> {
    static readonly NAME = "logseq_remove_property_from_tag_page";

    readonly name = LogseqRemovePropertyFromTagPageTool.NAME;
    readonly description =
        "Remove a property from a Logseq tag page. Logseq automatically removes it from blocks using the tag.";
    readonly parameters = RemovePropertyFromTagPageCommandArgsSchema;

    async execute(
        args: RemovePropertyFromTagPageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqRemovePropertyFromTagPageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RemovePropertyFromTagPageCommand(args));
            const tag = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {tag},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to remove property ${args.propertyPageUuid} from tag ${args.tagPageUuid}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
