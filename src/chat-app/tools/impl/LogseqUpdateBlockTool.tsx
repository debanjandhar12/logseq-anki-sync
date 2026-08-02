import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {addAndExecLogseqReversibleCommand} from "src/chat-app/tools/transaction/addAndExecLogseqReversibleCommand";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getTrackerArtifactFromError} from "src/chat-app/tools/transaction/getTrackerArtifactFromError";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    UpdateBlockCommand,
    type UpdateBlockCommandArgs,
    UpdateBlockCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqUpdateBlockResult = ChatToolSuccessResult | ChatToolErrorResult;

export class LogseqUpdateBlockTool extends BaseChatToolWithDefaultUI<
    UpdateBlockCommandArgs,
    LogseqUpdateBlockResult
> {
    static readonly NAME = "logseq_update_block";

    readonly name = LogseqUpdateBlockTool.NAME;
    readonly description = "Update a Logseq block by UUID.";
    readonly parameters = UpdateBlockCommandArgsSchema;

    async execute(
        args: UpdateBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqUpdateBlockResult>> {
        try {
            const {tracker} = await addAndExecLogseqReversibleCommand({
                command: new UpdateBlockCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to update Logseq block ${JSON.stringify(args.blockUuid)}: ${getErrorMessageFromErrObj(err)}`,
                getTrackerArtifactFromError(err)
            );
        }
    }
}
