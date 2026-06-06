import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {z} from "zod";

const LogseqClearChangesArgsZodObj = z.object({});

type LogseqClearChangesArgs = z.infer<typeof LogseqClearChangesArgsZodObj>;

type LogseqClearChangesResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqClearChangesTool extends BaseChatToolWithDefaultUI<
    LogseqClearChangesArgs,
    LogseqClearChangesResult
> {
    static readonly NAME = "logseq_clear_changes";

    readonly name = LogseqClearChangesTool.NAME;
    readonly description = "Clear pending Logseq graph changes made by block/page editing tools.";
    readonly parameters = LogseqClearChangesArgsZodObj;

    async execute(
        _args: LogseqClearChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<LogseqClearChangesResult | ToolResponse<LogseqClearChangesResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.clear();

            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to clear Logseq changes: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
