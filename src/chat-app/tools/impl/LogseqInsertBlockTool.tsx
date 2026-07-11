import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ToolErrorResult,
    type ToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    InsertBlockCommand,
    type InsertBlockCommandArgs,
    InsertBlockCommandArgsSchema,
    type LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";
import {createLogseqReversibleTransactionTrackerArtifact} from "../transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "../transaction/getLastLogseqReversibleTransactionTracker";

type LogseqInsertBlockResult =
    | ToolSuccessResult<{
          block: LogseqReversibleTransactionResult | undefined;
      }>
    | ToolErrorResult;

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
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new InsertBlockCommand(args));

            const block = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {block},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to insert Logseq block under ${JSON.stringify(args.parentUuid)}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
