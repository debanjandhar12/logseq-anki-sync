import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import type {PageEntityWithBlockChildren} from "src/logseq/types";
import {z} from "zod";

const readLogseqBlockParameters = z.object({
    uuid: z.string().describe("UUID of the Logseq block or page to read."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

type ReadLogseqBlockArgs = z.infer<typeof readLogseqBlockParameters>;

type ReadLogseqBlockResult =
    | {
          success: true;
          type: "block" | "page";
          block: BlockEntity | PageEntityWithBlockChildren;
      }
    | {
          success: false;
          error: string;
      };

export class ReadLogseqBlockTool extends BaseChatToolWithDefaultUI<
    ReadLogseqBlockArgs,
    ReadLogseqBlockResult
> {
    static readonly NAME = "ReadLogseqBlock";

    readonly name = ReadLogseqBlockTool.NAME;
    readonly description = "Read a Logseq block or page by UUID.";
    readonly parameters = readLogseqBlockParameters;

    async execute(
        {uuid, includeChildren = false}: ReadLogseqBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<ReadLogseqBlockResult> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            if (transactionTracker.toJSON().commands.length > 0) {
                return {
                    success: false,
                    error: "Cannot read Logseq blocks while there are uncommitted Logseq changes. Commit or clear the pending changes first."
                };
            }

            const page: PageEntityWithBlockChildren = await LogseqPropertiesHelper.getPage(uuid);
            if (page) {
                if (includeChildren) {
                    page.children = await LogseqPropertiesHelper.getPageBlocksTree(uuid);
                    return {success: true, type: "page", block: page};
                }

                return {success: true, type: "page", block: page};
            }

            const block = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren});
            if (!block) {
                return {success: false, error: `Logseq block not found: ${uuid}`};
            }

            return {success: true, type: "block", block};
        } catch (err) {
            return {
                success: false,
                error: `Failed to read Logseq block ${uuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
