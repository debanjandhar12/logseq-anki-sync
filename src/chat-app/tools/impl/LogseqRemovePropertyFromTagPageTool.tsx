import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
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
    | {success: true; tag: LogseqReversibleTransactionResult}
    | {success: false; error: string};

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
    ): Promise<
        LogseqRemovePropertyFromTagPageResult | ToolResponse<LogseqRemovePropertyFromTagPageResult>
    > {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new RemovePropertyFromTagPageCommand(args));
            const tag = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, tag},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to remove property ${args.propertyPageUuid} from tag ${args.tagPageUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
