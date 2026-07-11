import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    AddPropertyToTagPageCommand,
    type AddPropertyToTagPageCommandArgs,
    AddPropertyToTagPageCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqAddPropertyToTagPageResult =
    | {success: true; tag: LogseqReversibleTransactionResult}
    | {success: false; error: string};

export class LogseqAddPropertyToTagPageTool extends BaseChatToolWithDefaultUI<
    AddPropertyToTagPageCommandArgs,
    LogseqAddPropertyToTagPageResult
> {
    static readonly NAME = "logseq_add_property_to_tag_page";

    readonly name = LogseqAddPropertyToTagPageTool.NAME;
    readonly description =
        "Add a property to a Logseq tag page. Logseq automatically adds it to blocks using the tag.";
    readonly parameters = AddPropertyToTagPageCommandArgsSchema;

    async execute(
        args: AddPropertyToTagPageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqAddPropertyToTagPageResult | ToolResponse<LogseqAddPropertyToTagPageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new AddPropertyToTagPageCommand(args));
            const tag = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, tag},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to add property ${args.propertyPageUuid} to tag ${args.tagPageUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
