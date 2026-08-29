import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {blockHasMacro} from "../../../logseq-md-parser";
import {entityHasReference} from "./entityHasReference";

export async function isFlashcardBlock(block: BlockEntity): Promise<boolean> {
    const cardTag = await logseq.Editor.getTag("card");
    return entityHasReference(block.tags, cardTag ?? {}) || blockHasMacro(block, "cloze");
}
