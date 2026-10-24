import {LogseqPropertiesHelper} from "../../../logseq/LogseqPropertiesHelper";
import {countHighlightMaskGroups} from "./countHighlightMaskGroups";

export async function resolveHighlightMaskCount(
    blockId: string,
    value: unknown,
    fresh = false
): Promise<number | null> {
    const count = fresh ? null : countHighlightMaskGroups(value);
    if (count !== null) return count;
    // Normal block-property reads dereference values that Experiments can expose as UUIDs.
    const block = await LogseqPropertiesHelper.getBlock(blockId);
    return countHighlightMaskGroups(block?.properties?.highlight_mask);
}
