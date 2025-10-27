import {BlockEntity} from "@logseq/libs/dist/LSPlugin";

export default function getUUIDFromBlock(block: BlockEntity): string {
    return (
        (block?.uuid as any)?.['$uuid$'] ||
        (block?.uuid as any)?.Wd ||
        block?.uuid ||
        null
    );
}
