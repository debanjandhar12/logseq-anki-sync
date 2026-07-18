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
    ReadBlockCommand,
    type ReadBlockCommandArgs,
    ReadBlockCommandArgsSchema,
    type ReadBlockCommandResult
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqReadBlockResult =
    | ChatToolSuccessResult<{
          type: ReadBlockCommandResult["type"];
          block: ReadBlockCommandResult["block"];
      }>
    | ChatToolErrorResult;

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
            const {result, tracker} = await executeLogseqReversibleCommand<ReadBlockCommandResult>({
                command: new ReadBlockCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {...result},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read Logseq entity ${args.uuid ?? args.propertyIndent}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
