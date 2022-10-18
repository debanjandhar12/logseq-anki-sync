import {BlockUUID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import { LOGSEQ_BLOCK_REF_REGEXP, LOGSEQ_EMBDED_PAGE_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP } from "../constants";
export type DependencyEntity = {
    type: "FirstLineOfBlock" | "Block" | "Page",
    value: BlockUUID | PageEntityName
}
export default function getContentDirectDependencies(content: string, format: string = "markdown"): DependencyEntity[] {
    if(content == null || content == undefined) return [];
    let blockDependency: Set<BlockUUID> = new Set();
    let firstLineOfBlockDependency: Set<BlockUUID> = new Set();
    let pageDependency: Set<PageEntityName> = new Set();
    //  Add dependencies due to LOGSEQ_EMBDED_BLOCK_REGEXP
    let match;
    while (match = LOGSEQ_EMBDED_BLOCK_REGEXP.exec(content)) {
        blockDependency.add(match[1]);
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