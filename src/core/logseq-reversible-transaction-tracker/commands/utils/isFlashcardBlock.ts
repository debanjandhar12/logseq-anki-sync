import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {blockHasMacro} from "../../../logseq-md-parser";
import {entityHasReference} from "./entityHasReference";
import {getTagByNameOrIdent} from "./getTagByNameOrIdent";

export async function isFlashcardBlock(block: BlockEntity): Promise<boolean> {
    const cardTag = await getTagByNameOrIdent("card", ":logseq.class/Card");
    return entityHasReference(block.tags, cardTag ?? {}) || blockHasMacro(block, "cloze");
}
