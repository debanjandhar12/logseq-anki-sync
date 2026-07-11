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
    ReadBlockCommand,
    type ReadBlockCommandArgs,
    ReadBlockCommandArgsSchema,
    type ReadBlockCommandResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqReadBlockResult =
    | ToolSuccessResult<{
          type: ReadBlockCommandResult["type"];
          block: ReadBlockCommandResult["block"];
      }>
    | ToolErrorResult;

export class LogseqReadBlockTool extends BaseChatToolWithDefaultUI<
    ReadBlockCommandArgs,
    LogseqReadBlockResult
> {
    static readonly NAME = "logseq_read_block";

    readonly name = LogseqReadBlockTool.NAME;
    readonly description =
        "Read a Logseq block, page, or tag page by UUID, or a property by propertyIndent.";
    readonly parameters = ReadBlockCommandArgsSchema;

    async execute(
        args: ReadBlockCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqReadBlockResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new ReadBlockCommand(args));

            const result = (await transactionTracker.execute()) as ReadBlockCommandResult;
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {...result},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read Logseq entity ${args.uuid ?? args.propertyIndent}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
