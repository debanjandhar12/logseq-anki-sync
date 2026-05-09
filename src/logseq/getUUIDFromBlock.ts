import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";

/**
 * Get UUID from block entity
 * Works on page entity as well since all pages are blocks too
 * @param block
 */
export default function getUUIDFromBlock(block: BlockEntity | {uuid: string}): string {
    return (block?.uuid as any)?.["$uuid$"] || (block?.uuid as any)?.Wd || block?.uuid || null;
}
