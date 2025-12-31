import {BlockEntity} from "@logseq/libs/dist/LSPlugin";

export default function getUUIDFromBlock(block: BlockEntity | {uuid: string}): string {
    return (
        (block?.uuid as any)?.['$uuid$'] ||
        (block?.uuid as any)?.Wd ||
        block?.uuid ||
        null
    );
}
