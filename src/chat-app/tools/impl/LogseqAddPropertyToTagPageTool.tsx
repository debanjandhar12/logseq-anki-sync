import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {executeLogseqReversibleCommand} from "src/chat-app/tools/transaction/executeLogseqReversibleCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    AddPropertyToTagPageCommand,
    type AddPropertyToTagPageCommandArgs,
    AddPropertyToTagPageCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqAddPropertyToTagPageResult =
    | ChatToolSuccessResult<{tag: LogseqReversibleTransactionResult}>
    | ChatToolErrorResult;

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
    ): Promise<ChatToolResponse<LogseqAddPropertyToTagPageResult>> {
        try {
            const {result: tag, tracker} = await executeLogseqReversibleCommand({
                command: new AddPropertyToTagPageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {tag},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to add property ${args.propertyPageUuid} to tag ${args.tagPageUuid}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
