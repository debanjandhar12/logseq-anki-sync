import {LogseqPropertiesHelper} from "../../../logseq/LogseqPropertiesHelper";
import {countOcclusionGroups} from "./countOcclusionGroups";

export async function resolveOcclusionCount(
    blockId: string,
    value: unknown,
    fresh = false
): Promise<number | null> {
    const count = fresh ? null : countOcclusionGroups(value);
    if (count !== null) return count;
    // Normal block-property reads dereference values that Experiments can expose as UUIDs.
    const block = await LogseqPropertiesHelper.getBlock(blockId);
    return countOcclusionGroups(block?.properties?.occlusion);
}
