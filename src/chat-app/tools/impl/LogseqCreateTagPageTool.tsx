import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ToolErrorResult,
    type ToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    CreateTagPageCommand,
    type CreateTagPageCommandArgs,
    CreateTagPageCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqCreateTagPageResult =
    | ToolSuccessResult<{tag: LogseqReversibleTransactionResult}>
    | ToolErrorResult;

export class LogseqCreateTagPageTool extends BaseChatToolWithDefaultUI<
    CreateTagPageCommandArgs,
    LogseqCreateTagPageResult
> {
    static readonly NAME = "logseq_create_tag_page";

    readonly name = LogseqCreateTagPageTool.NAME;
    readonly description = "Create a Logseq tag page by name.";
    readonly parameters = CreateTagPageCommandArgsSchema;

    async execute(
        args: CreateTagPageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqCreateTagPageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new CreateTagPageCommand(args));
            const tag = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {tag},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to create Logseq tag page ${args.tagName}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
