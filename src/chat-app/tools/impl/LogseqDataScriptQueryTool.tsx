import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqFakeableTransactionTrackerSerializer} from "src/core/logseq-fakeable-transaction-tracker";
import {z} from "zod";

const LogseqDataScriptQueryArgsZodObj = z.object({
    datalogString: z.string().describe("Logseq DataScript datalog query string to execute."),
    inputs: z
        .array(z.string())
        .default([])
        .describe("Input strings to spread into the DataScript query after the query string.")
});

type LogseqDataScriptQueryArgs = z.infer<typeof LogseqDataScriptQueryArgsZodObj>;

type LogseqDataScriptQueryResult =
    | {
          success: true;
          result: unknown;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqDataScriptQueryTool extends BaseChatToolWithDefaultUI<
    LogseqDataScriptQueryArgs,
    LogseqDataScriptQueryResult
> {
    static readonly NAME = "logseq_datascript_query";

    readonly name = LogseqDataScriptQueryTool.NAME;
    readonly description = "Run a Logseq DataScript datalog query with optional string inputs.";
    readonly parameters = LogseqDataScriptQueryArgsZodObj;

    async execute(
        {datalogString, inputs}: LogseqDataScriptQueryArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqDataScriptQueryResult> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            if (
                LogseqFakeableTransactionTrackerSerializer.serialize(transactionTracker).commands
                    .length > 0
            ) {
                throw new Error(
                    "Cannot query Logseq while there are uncommitted Logseq changes. Commit or clear the pending changes first."
                );
            }

            let result: any;
            if (inputs && inputs.length > 0) {
                result = await logseq.DB.datascriptQuery(datalogString, ...inputs);
            } else {
                result = await logseq.DB.datascriptQuery(datalogString);
            }
            return {success: true, result};
        } catch (err) {
            return {
                success: false,
                error: `Failed to run Logseq DataScript query: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
