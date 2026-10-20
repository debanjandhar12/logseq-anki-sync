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
    const isDbGraph = await LogseqProxy.App.checkCurrentIsDbGraph();
    if (isDbGraph) {
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
    for (const match of content.matchAll(LOGSEQ_EMBDED_BLOCK_REGEXP)) {
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
    for (const match of content.matchAll(LOGSEQ_BLOCK_REF_REGEXP)) {
        blockDependency.add(match[1]);
    }

    // Add dependencies due to LOGSEQ_EMBDED_PAGE_REGEXP
    for (const pageMatch of content.matchAll(LOGSEQ_EMBDED_PAGE_REGEXP)) {
        const pageIdentity = isDbGraph ? safeParseInt(pageMatch[1]) : pageMatch[1];
        if (isDbGraph && !Number.isInteger(pageIdentity)) continue;
        const page = await LogseqProxy.Editor.getPage(pageIdentity);
        if (!page) continue;

        pageDependency.add(page.id);
        const queue = [...(await LogseqProxy.Editor.getPageBlocksTree(page.id))];
        while (queue.length > 0) {
            const block = queue.pop();
            blockDependency.add(getUUIDFromBlock(block));
            if (block.children) queue.push(...(block.children as BlockEntity[]));
        }
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
