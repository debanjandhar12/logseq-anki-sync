import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {z} from "zod";

const simpleDSLQueryLogseqParameters = z.object({
    dslString: z.string().describe("Logseq simple DSL query string to execute.")
});

type SimpleDSLQueryLogseqArgs = z.infer<typeof simpleDSLQueryLogseqParameters>;

type SimpleDSLQueryLogseqResult =
    | {
          success: true;
          result: unknown;
      }
    | {
          success: false;
          error: string;
      };

export class SimpleDSLQueryLogseqTool extends BaseChatToolWithDefaultUI<
    SimpleDSLQueryLogseqArgs,
    SimpleDSLQueryLogseqResult
> {
    static readonly NAME = "SimpleDSLQueryLogseq";

    readonly name = SimpleDSLQueryLogseqTool.NAME;
    readonly description = "Run a simple Logseq DSL query with logseq.DB.q.";
    readonly parameters = simpleDSLQueryLogseqParameters;

    async execute(
        {dslString}: SimpleDSLQueryLogseqArgs,
        context?: ChatToolExecutionContext
    ): Promise<SimpleDSLQueryLogseqResult> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            if (transactionTracker.toJSON().commands.length > 0) {
                throw new Error(
                    "Cannot query Logseq while there are uncommitted Logseq changes. Commit or clear the pending changes first."
                );
            }

            const result = await logseq.DB.q(dslString);
            return {success: true, result};
        } catch (err) {
            return {
                success: false,
                error: `Failed to run Logseq DSL query: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
