import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import {BaseChatTool} from "../base/BaseChatTool";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";

export const READ_LOGSEQ_BLOCK_TOOL_NAME = "ReadLogseqBlock";

const readLogseqBlockParameters = z.object({
    uuid: z.string().describe("UUID of the Logseq block or page to read."),
    includeChildren: z
        .boolean()
        .optional()
        .describe("Whether to include child blocks")
});

type ReadLogseqBlockArgs = z.infer<typeof readLogseqBlockParameters>;

type ReadLogseqBlockResult =
    | {
          success: true;
          type: "block" | "page";
          block: BlockEntity | PageEntity;
          children?: BlockEntity[];
      }
    | {
          success: false;
          error: string;
      };

export class ReadLogseqBlockTool extends BaseChatTool<ReadLogseqBlockArgs, ReadLogseqBlockResult> {
    readonly name = READ_LOGSEQ_BLOCK_TOOL_NAME;
    readonly description = "Read a Logseq block or page by UUID.";
    readonly parameters = readLogseqBlockParameters;

    async execute({
        uuid,
        includeChildren = false
    }: ReadLogseqBlockArgs): Promise<ReadLogseqBlockResult> {
        try {
            const page = await LogseqPropertiesHelper.getPage(uuid);
            if (page) {
                if (includeChildren) {
                    const children = await LogseqPropertiesHelper.getPageBlocksTree(uuid);
                    return {success: true, type: "page", block: page, children};
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