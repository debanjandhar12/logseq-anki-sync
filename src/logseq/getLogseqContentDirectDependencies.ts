import type {BlockEntity, BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {
    LOGSEQ_BLOCK_REF_REGEXP,
    LOGSEQ_EMBDED_BLOCK_REGEXP,
    LOGSEQ_EMBDED_PAGE_REGEXP
} from "../constants";
import {safeParseInt} from "../utils/utils";
import getUUIDFromBlock from "./getUUIDFromBlock";
import {LogseqContentPreprocessorProxy} from "./LogseqContentPreprocessor";
import {LogseqProxy} from "./LogseqProxy";

export interface BlockDependency {
    type: "Block";
    value: BlockUUID;
}

export interface PageDependency {
    type: "Page";
    value: number; // Page ID
}

export type DependencyEntity = BlockDependency | PageDependency;
export default async function getLogseqContentDirectDependencies(
    content: string,
    format = "markdown"
): Promise<DependencyEntity[]> {
    // Normalize content to our internal format
    if (await LogseqProxy.App.checkCurrentIsDbGraph()) {
        const preprocessResult = await LogseqContentPreprocessorProxy.preprocess(
            content,
            format as "markdown" | "org"
        );
        content = preprocessResult.content;
    }
    if (content === null || content === undefined) return [];
    const blockDependency: Set<BlockUUID> = new Set();
    const pageDependency: Set<number> = new Set();

    //  Add dependencies due to LOGSEQ_EMBDED_BLOCK_REGEXP
    let match;
    while ((match = LOGSEQ_EMBDED_BLOCK_REGEXP.exec(content))) {
        const block = await LogseqProxy.Editor.getBlock(match[1], {
            includeChildren: true
        });
        // Add all children of block as dependencies
        if (block) {
            const queue = [block];
            while (queue.length > 0) {
                const block = queue.pop();
                blockDependency.add(getUUIDFromBlock(block));
                if (block.children) {
                    for (const child of block.children) {
                        if (queue.length > 30) break;
                        queue.push(child as BlockEntity);
                    }
                }
            }
        }
    }

    // Add dependencies due to LOGSEQ_BLOCK_REF_REGEXP
    while ((match = LOGSEQ_BLOCK_REF_REGEXP.exec(content))) {
        blockDependency.add(match[1]);
    }

    // Add dependencies due to LOGSEQ_EMBDED_PAGE_REGEXP
    while ((match = LOGSEQ_EMBDED_PAGE_REGEXP.exec(content))) {
        const pageIdStr = match[1];
        const pageId = safeParseInt(pageIdStr);

        const isValidNumber =
            typeof pageId === "number" && !Number.isNaN(pageId) && Number.isInteger(pageId);
        if (!isValidNumber) continue;

        pageDependency.add(pageId);
        // TODO: Add all blocks in the page as dependencies if req
    }

    return [
        ...Array.from(blockDependency).map(
            (block) => ({type: "Block", value: block}) as DependencyEntity
        ),
        ...Array.from(pageDependency).map(
            (page) => ({type: "Page", value: page}) as DependencyEntity
        )
    ];
}
