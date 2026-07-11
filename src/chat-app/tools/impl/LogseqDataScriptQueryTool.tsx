import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ChatToolErrorResult,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    DataScriptQueryCommand,
    type DataScriptQueryCommandArgs,
    DataScriptQueryCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqDataScriptQueryResult = ChatToolSuccessResult<{result: unknown}> | ChatToolErrorResult;

export class LogseqDataScriptQueryTool extends BaseChatToolWithDefaultUI<
    DataScriptQueryCommandArgs,
    LogseqDataScriptQueryResult
> {
    static readonly NAME = "logseq_datascript_query";

    readonly name = LogseqDataScriptQueryTool.NAME;
    readonly description = "Run a Logseq DataScript datalog query with optional string inputs.";
    readonly parameters = DataScriptQueryCommandArgsSchema;

    async execute(
        args: DataScriptQueryCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqDataScriptQueryResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            transactionTracker.addCommand(new DataScriptQueryCommand(args));

            const result = await transactionTracker.execute();
            await transactionTracker.revert();

            return ChatToolResponse.success(
                {result},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to run Logseq DataScript query: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
