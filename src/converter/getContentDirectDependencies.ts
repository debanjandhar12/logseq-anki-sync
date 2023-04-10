import {BlockEntity, BlockUUID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import { LOGSEQ_BLOCK_REF_REGEXP, LOGSEQ_EMBDED_PAGE_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP } from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
export type DependencyEntity = {
    type: "FirstLineOfBlock" | "Block" | "Page",
    value: BlockUUID | PageEntityName
}
export default async function getContentDirectDependencies(content: string, format: string = "markdown"): Promise<DependencyEntity[]> {
    if(content == null || content == undefined) return [];
    let blockDependency: Set<BlockUUID> = new Set();
    let firstLineOfBlockDependency: Set<BlockUUID> = new Set();
    let pageDependency: Set<PageEntityName> = new Set();
    //  Add dependencies due to LOGSEQ_EMBDED_BLOCK_REGEXP
    let match;
    while (match = LOGSEQ_EMBDED_BLOCK_REGEXP.exec(content)) {
        let block = await LogseqProxy.Editor.getBlock(match[1], {includeChildren: true});
        // Add all children of block as dependencies
        if (block) {
            const queue = [block];
            while (queue.length > 0) {
                let block = queue.pop();
                blockDependency.add(block.uuid);
                if (block.children) {
                    for (let child of block.children) {
                        if(queue.length > 30) break;
                        queue.push(child as BlockEntity);
                    }
                }
            }
        }
    }
    // Add dependencies due to LOGSEQ_BLOCK_REF_REGEXP
    while (match = LOGSEQ_BLOCK_REF_REGEXP.exec(content)) {
        firstLineOfBlockDependency.add(match[1]);
    }
    // Add dependencies due to LOGSEQ_EMBDED_PAGE_REGEXP
    while (match = LOGSEQ_EMBDED_PAGE_REGEXP.exec(content)) {
        pageDependency.add(new PageEntityName(match[1]));
    }
    return [...Array.from(firstLineOfBlockDependency).map(block => ({ type: "FirstLineOfBlock", value: block } as DependencyEntity)),
            ...Array.from(blockDependency).map(block => ({ type: "Block", value: block } as DependencyEntity)),
            ...Array.from(pageDependency).map(page => ({ type: "Page", value: page } as DependencyEntity))];
}

export class PageEntityName {
    constructor(public name: string) {
        this.name = name;
    }
}
