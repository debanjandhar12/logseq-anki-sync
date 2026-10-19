import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {blockHasLatex} from "../../../logseq-md-parser";
import {entityHasReference} from "./entityHasReference";
import {getTagByNameOrIdent} from "./getTagByNameOrIdent";

export async function isMathBlock(block: BlockEntity): Promise<boolean> {
    const mathTag = await getTagByNameOrIdent("Math", ":logseq.class/Math-block");
    return entityHasReference(block.tags, mathTag ?? {}) || blockHasLatex(block);
}
