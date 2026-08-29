import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {blockHasMacro} from "../../../logseq-md-parser";

export function isVideoBlock(block: Pick<BlockEntity, "content" | "format">): boolean {
    return blockHasMacro(block, "video");
}
