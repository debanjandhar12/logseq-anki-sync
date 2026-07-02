import type {BlockEntity, BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {isBlockSoftDeleted} from "../isBlockSoftDeleted";
import {normalizeBlock} from "../normalizeBlock";

function formatBlockLabel(label: string | undefined): string {
    return label ? `${label} block` : "Block";
}

export async function requireExistingBlock(
    blockIdentity: BlockIdentity,
    label?: string
): Promise<BlockEntity> {
    const block = await logseq.Editor.getBlock(blockIdentity);
    if (!block)
        throw new Error(`${formatBlockLabel(label)} not found: ${JSON.stringify(blockIdentity)}`);

    return await normalizeBlock(block);
}

export async function requireActiveBlock(
    blockIdentity: BlockIdentity,
    label?: string
): Promise<BlockEntity> {
    const block = await requireExistingBlock(blockIdentity, label);
    if (await isBlockSoftDeleted(block)) {
        throw new Error(
            `${formatBlockLabel(label)} is in a deleted page: ${JSON.stringify(blockIdentity)}`
        );
    }

    return block;
}
