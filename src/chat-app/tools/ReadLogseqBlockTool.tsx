import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {Tool, ToolResponse} from "assistant-stream";
import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import {useState} from "react";
import {Button} from "src/shadcn/radix-ui/button";
import {CheckIcon, XIcon} from "lucide-react";

type ReadLogseqBlockArgs = {
    uuid: string;
    includeChildren?: boolean;
};

type ReadLogseqBlockResult =
    | {
    success: true;
    type: "block" | "page";
    block: BlockEntity | PageEntity;
}
    | {
    success: false;
    error: string;
};

export const ReadLogseqBlockTool: Tool<ReadLogseqBlockArgs, ReadLogseqBlockResult> =  {
    type: "frontend",
    description:
        "Read Logseq block or page by uuid.",
    // TBU: define params using zod
}

async function execute({
                      uuid,
                      includeChildren = false
                      }: ReadLogseqBlockArgs): Promise<ReadLogseqBlockResult> {
    try {
        const pageBlockTree = await LogseqPropertiesHelper.getPageBlocksTree(uuid);
        if (pageBlockTree) {
            const page = await LogseqPropertiesHelper.getPage(uuid);
            if (includeChildren) {
                page.children = pageBlockTree as unknown as PageEntity[];
            }
            return {success: true, type: "page", block: page};
        }
        const block = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren: includeChildren});
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
