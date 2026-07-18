import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {addAndExecLogseqReversibleCommand} from "src/chat-app/tools/transaction/addAndExecLogseqReversibleCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    CreateTagPageCommand,
    type CreateTagPageCommandArgs,
    CreateTagPageCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqCreateTagPageResult =
    | ChatToolSuccessResult<{tag: LogseqReversibleTransactionResult}>
    | ChatToolErrorResult;

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
            const {result: tag, tracker} = await addAndExecLogseqReversibleCommand({
                command: new CreateTagPageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {tag},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to create Logseq tag page ${args.tagName}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
