import { BlockUUID } from "@logseq/libs/dist/LSPlugin";
import { LOGSEQ_BLOCK_REF_REGEXP, LOGSEQ_EMBDED_PAGE_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP } from "../constants";
export type ReferenceDependency = {
    type: "Embedded_Page_ref" | "Block_ref" | "Embedded_Block_ref",
    value: BlockUUID | PageEntityName
}
export default function getContentDirectDependencies(content: string, format: string = "markdown"): ReferenceDependency[] {
    if(content == null || content == undefined) return [];
    let blockRefDependency: Set<BlockUUID> = new Set();
    let blockEmbededDependency: Set<BlockUUID> = new Set();
    let pageEmbededDependency: Set<PageEntityName> = new Set();
    //  Add dependencies due to LOGSEQ_EMBDED_BLOCK_REGEXP
    let match;
    while (match = LOGSEQ_EMBDED_BLOCK_REGEXP.exec(content)) {
        blockEmbededDependency.add(match[1]);
    }
    // Add dependencies due to LOGSEQ_BLOCK_REF_REGEXP
    while (match = LOGSEQ_BLOCK_REF_REGEXP.exec(content)) {
        blockRefDependency.add(match[1]);
    }
    // Add dependencies due to LOGSEQ_EMBDED_PAGE_REGEXP
    while (match = LOGSEQ_EMBDED_PAGE_REGEXP.exec(content)) {
        pageEmbededDependency.add(new PageEntityName(match[1]));
    }
    return [...Array.from(blockRefDependency).map(block => ({ type: "Block_ref", value: block } as ReferenceDependency)),
            ...Array.from(blockEmbededDependency).map(block => ({ type: "Embedded_Block_ref", value: block } as ReferenceDependency)),
            ...Array.from(pageEmbededDependency).map(page => ({ type: "Embedded_Page_ref", value: page } as ReferenceDependency))];
}

export class PageEntityName {
    constructor(public name: string) {
        this.name = name;
    }
}