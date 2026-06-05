import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqFakeableTransactionTrackerSerializer} from "src/core/logseq-fakeable-transaction-tracker";
import {z} from "zod";

const dataScriptQueryLogseqParameters = z.object({
    datalogString: z.string().describe("Logseq DataScript datalog query string to execute."),
    inputs: z
        .array(z.string())
        .default([])
        .describe(
            "Input strings to spread into the DataScript query after the query string."
        )
});

type DataScriptQueryLogseqArgs = z.infer<typeof dataScriptQueryLogseqParameters>;

type DataScriptQueryLogseqResult =
    | {
          success: true;
          result: unknown;
      }
    | {
          success: false;
          error: string;
      };

export class DataScriptQueryLogseqTool extends BaseChatToolWithDefaultUI<
    DataScriptQueryLogseqArgs,
    DataScriptQueryLogseqResult
> {
    static readonly NAME = "DataScriptQueryLogseq";

    readonly name = DataScriptQueryLogseqTool.NAME;
    readonly description = "Run a Logseq DataScript datalog query with optional string inputs.";
    readonly parameters = dataScriptQueryLogseqParameters;

    async execute(
        {datalogString, inputs}: DataScriptQueryLogseqArgs,
        context?: ChatToolExecutionContext
    ): Promise<DataScriptQueryLogseqResult> {
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

            const result = await logseq.DB.datascriptQuery(datalogString, ...inputs);
            return {success: true, result};
        } catch (err) {
            return {
                success: false,
                error: `Failed to run Logseq DataScript query: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
