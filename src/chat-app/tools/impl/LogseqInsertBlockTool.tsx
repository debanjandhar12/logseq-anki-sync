import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    InsertBlockCommand,
    type InsertBlockCommandArgs,
    InsertBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";
import {addAndExecLogseqReversibleCommand} from "../transaction/addAndExecLogseqReversibleCommand";
import {createLogseqReversibleTransactionTrackerArtifact} from "../transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getTrackerArtifactFromError} from "../transaction/getTrackerArtifactFromError";

type LogseqInsertBlockResult =
    | ChatToolSuccessResult<{
          block: LogseqReversibleTransactionResult | undefined;
      }>
    | ChatToolErrorResult;

export class LogseqInsertBlockTool extends BaseChatToolWithDefaultUI<
    InsertBlockCommandArgs,
    LogseqInsertBlockResult
> {
    static readonly NAME = "logseq_insert_block";

    readonly name = LogseqInsertBlockTool.NAME;
    readonly description = "Insert a Logseq block under a parent block or page by UUID.";
    readonly parameters = InsertBlockCommandArgsSchema;

    async execute(
        args: InsertBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqInsertBlockResult>> {
        try {
            const {result: block, tracker} = await addAndExecLogseqReversibleCommand({
                command: new InsertBlockCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {block},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to insert Logseq block under ${JSON.stringify(args.parentUuid)}: ${getErrorMessageFromErrObj(err)}`,
                getTrackerArtifactFromError(err)
            );
        }
    }
}
