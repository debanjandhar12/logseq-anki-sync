import { BlockUUID } from "@logseq/libs/dist/LSPlugin";
import { LOGSEQ_BLOCK_REF_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP } from "../constants";

export default function getContentDirectDependencies(content: string, format: string = "markdown"): BlockUUID[] {
    if(content == null || content == undefined) return [];
    let result: Set<BlockUUID> = new Set();
    //Add group 1 of all matches of LOGSEQ_EMBDED_BLOCK_REGEXP to result
    let match;
    while (match = LOGSEQ_EMBDED_BLOCK_REGEXP.exec(content)) {
        result.add(match[1]);
    }
    //Add group 1 of all matches of LOGSEQ_BLOCK_REF_REGEXP to result
    while (match = LOGSEQ_BLOCK_REF_REGEXP.exec(content)) {
        result.add(match[1]);
    }
    return [...result];
}