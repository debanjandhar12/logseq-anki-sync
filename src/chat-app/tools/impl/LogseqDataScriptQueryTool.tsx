import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {execLogseqReadOnlyCommand} from "src/chat-app/tools/transaction/execLogseqReadOnlyCommand";
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
            const result = await execLogseqReadOnlyCommand(new DataScriptQueryCommand(args), {
                signal: context?.abortSignal
            });

            return ChatToolResponse.success({result});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to run Logseq DataScript query: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
