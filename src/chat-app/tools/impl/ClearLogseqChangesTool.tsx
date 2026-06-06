import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {z} from "zod";

const clearLogseqChangesParameters = z.object({});

type ClearLogseqChangesArgs = z.infer<typeof clearLogseqChangesParameters>;

type ClearLogseqChangesResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class ClearLogseqChangesTool extends BaseChatToolWithDefaultUI<
    ClearLogseqChangesArgs,
    ClearLogseqChangesResult
> {
    static readonly NAME = "clear_logseq_changes";

    readonly name = ClearLogseqChangesTool.NAME;
    readonly description = "Clear pending Logseq graph changes made by block/page editing tools.";
    readonly parameters = clearLogseqChangesParameters;

    async execute(
        _args: ClearLogseqChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<ClearLogseqChangesResult | ToolResponse<ClearLogseqChangesResult>> {
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
