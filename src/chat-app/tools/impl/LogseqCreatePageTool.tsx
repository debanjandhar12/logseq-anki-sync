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
    CreatePageCommand,
    type CreatePageCommandArgs,
    CreatePageCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqCreatePageResult =
    | ToolSuccessResult<{page: LogseqReversibleTransactionResult | undefined}>
    | ToolErrorResult;

export class LogseqCreatePageTool extends BaseChatToolWithDefaultUI<
    CreatePageCommandArgs,
    LogseqCreatePageResult
> {
    static readonly NAME = "logseq_create_page";

    readonly name = LogseqCreatePageTool.NAME;
    readonly description = "Create a Logseq page by name.";
    readonly parameters = CreatePageCommandArgsSchema;

    async execute(
        args: CreatePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqCreatePageResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new CreatePageCommand(args));

            const page = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {page},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to create Logseq page ${args.pageName}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
