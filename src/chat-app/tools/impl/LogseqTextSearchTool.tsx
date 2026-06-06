import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqFakeableTransactionTrackerSerializer} from "src/core/logseq-fakeable-transaction-tracker";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";
import {LogseqAppInfoFetcher} from "src/logseq/LogseqAppInfoFetcher";

const LogseqTextSearchArgsZodObj = z.object({
    searchString: z.string().describe("Text to search for in Logseq.")
});

type LogseqTextSearchArgs = z.infer<typeof LogseqTextSearchArgsZodObj>;

type LogseqTextSearchResult =
    | {
          success: true;
          result: unknown;
      }
    | {
          success: false;
          error: string;
      };

/**
 * TODO: logseq.api.search likely supports pagination so need to add support for it.
 */
export class LogseqTextSearchTool extends BaseChatToolWithDefaultUI<
    LogseqTextSearchArgs,
    LogseqTextSearchResult
> {
    static readonly NAME = "logseq_text_search";

    readonly name = LogseqTextSearchTool.NAME;
    readonly description = "Search Logseq for pages and blocks matching a text string.";
    readonly parameters = LogseqTextSearchArgsZodObj;

    async execute(
        {searchString}: LogseqTextSearchArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqTextSearchResult> {
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

            // @ts-ignore
            if (!LogseqAppInfoFetcher.checkHostAccess()) {
                throw new Error("Window.parent access is required to call logseq.api.search. Plugin API does not have this method.");
            }
            const result = await (WindowParentBridge.getLogseqObject() as any).api.search(searchString);
            return {success: true, result};
        } catch (err) {
            return {
                success: false,
                error: `Failed to search Logseq text: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
