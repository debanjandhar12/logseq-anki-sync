import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
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
    | {success: true; tag: LogseqReversibleTransactionResult}
    | {success: false; error: string};

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
    ): Promise<LogseqCreateTagPageResult | ToolResponse<LogseqCreateTagPageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new CreateTagPageCommand(args));
            const tag = await transactionTracker.execute();
            await transactionTracker.revert();

            return new ToolResponse({
                result: {success: true, tag},
                artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to create Logseq tag page ${args.tagName}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
