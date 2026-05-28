import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import type {Tool} from "assistant-stream";
import {FileTextIcon} from "lucide-react";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";

export const READ_LOGSEQ_BLOCK_TOOL_NAME = "ReadLogseqBlock";

const readLogseqBlockParameters = z.object({
    uuid: z.string().describe("The UUID of the Logseq block or page to read."),
    includeChildren: z
        .boolean()
        .optional()
        .describe("Whether to include child blocks in the returned block or page.")
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

export const ReadLogseqBlockTool: Tool<ReadLogseqBlockArgs, ReadLogseqBlockResult> = {
    type: "frontend",
    description: "Read a Logseq block or page by UUID.",
    parameters: readLogseqBlockParameters,
    execute
};

async function execute({
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
    } catch (err) {
        return {success: false, error: `Failed to read Logseq block ${uuid}: ${getErrorMessage(err)}`};
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "Unknown error";
}
