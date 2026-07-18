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
    DeletePageCommand,
    type DeletePageCommandArgs,
    DeletePageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDeletePageResult = ChatToolSuccessResult | ChatToolErrorResult;

export class LogseqDeletePageTool extends BaseChatToolWithDefaultUI<
    DeletePageCommandArgs,
    LogseqDeletePageResult
> {
    static readonly NAME = "logseq_delete_page";

    readonly name = LogseqDeletePageTool.NAME;
    readonly description = "Delete a Logseq page by name or UUID.";
    readonly parameters = DeletePageCommandArgsSchema;

    async execute(
        args: DeletePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqDeletePageResult>> {
        try {
            const {tracker} = await executeLogseqReversibleCommand({
                command: new DeletePageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to delete Logseq page ${JSON.stringify(args.pageUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
