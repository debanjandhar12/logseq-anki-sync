import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";

const LogseqReadBlockArgsZodObj = z.object({
    uuid: z.string().describe("UUID of the Logseq block or page to read."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

type LogseqReadBlockArgs = z.infer<typeof LogseqReadBlockArgsZodObj>;

type LogseqReadBlockResult =
    | {
          success: true;
          type: "block" | "page";
          block: BlockEntity | PageEntity;
      }
    | {
          success: false;
          error: string;
      };

export class LogseqReadBlockTool extends BaseChatToolWithDefaultUI<
    LogseqReadBlockArgs,
    LogseqReadBlockResult
> {
    static readonly NAME = "logseq_read_block";

    readonly name = LogseqReadBlockTool.NAME;
    readonly description = "Read a Logseq block or page by UUID.";
    readonly parameters = LogseqReadBlockArgsZodObj;

    async execute(
        {uuid, includeChildren = false}: LogseqReadBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqReadBlockResult> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            await transactionTracker.execute();
            try {
                const block = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren});
                const page = block ? null : await LogseqPropertiesHelper.getPage(uuid);

                if (!block && !page) {
                    return {success: false, error: `Logseq block not found: ${uuid}`};
                }

                return block
                    ? {success: true, type: "block", block}
                    : {success: true, type: "page", block: page};
            } finally {
                await transactionTracker.revert();
            }
        } catch (err) {
            return {
                success: false,
                error: `Failed to read Logseq block ${uuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
