import type {BlockEntity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";

type EntityReferenceWithID = {id: EntityID};
type EntityReferenceWithUUID = {uuid: string};
export type ResolvableEntityReference = EntityID | EntityReferenceWithID | EntityReferenceWithUUID;

function hasUUID(value: unknown): value is EntityReferenceWithUUID {
    return typeof value === "object" && value !== null && "uuid" in value;
}

function getEntityID(value: unknown): EntityID | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "object" && value !== null && "id" in value) {
        const id = (value as EntityReferenceWithID).id;
        if (typeof id === "number") return id;
    }

    return undefined;
}

export async function resolvePageUUID(
    reference: ResolvableEntityReference | undefined
): Promise<string> {
    if (hasUUID(reference)) return reference.uuid;

    const id = getEntityID(reference);
    if (id === undefined) throw new Error("Block page reference is missing or invalid");

    const page = await logseq.Editor.getPage(id);
    if (!page?.uuid) throw new Error(`Unable to resolve page reference: ${id}`);

    return page.uuid;
}

async function resolveParentUUID(
    reference: ResolvableEntityReference | undefined
): Promise<string> {
    if (hasUUID(reference)) return reference.uuid;

    const id = getEntityID(reference);
    if (id === undefined) throw new Error("Block parent reference is missing or invalid");

    const entity = (await logseq.Editor.getBlock(id)) as BlockEntity | PageEntity | null;
    if (!entity?.uuid) throw new Error(`Unable to resolve parent reference: ${id}`);

    if (await LogseqEditor.isPageBlock(entity)) {
        const page = await logseq.Editor.getPage(id);
        if (!page?.uuid) throw new Error(`Unable to resolve parent page reference: ${id}`);
        return page.uuid;
    }

    const block = await logseq.Editor.getBlock(id);
    if (!block?.uuid) throw new Error(`Unable to resolve parent block reference: ${id}`);

    return block.uuid;
}

function isBlockEntity(value: unknown): value is BlockEntity {
    return typeof value === "object" && value !== null && "id" in value && "uuid" in value;
}

export async function normalizeBlock(block: BlockEntity): Promise<BlockEntity> {
    if (!block?.uuid && typeof block?.id === "number") {
        const completeBlock = await logseq.Editor.getBlock(block.id);
        if (!completeBlock?.uuid) throw new Error(`Unable to resolve block UUID: ${block.id}`);
        block = {...completeBlock, ...block, uuid: completeBlock.uuid};
    }

    if (!block?.uuid) throw new Error("Block UUID is missing");

    const normalizedBlock = block;
    if (block.page?.id) {
        normalizedBlock.page = {
            uuid: await resolvePageUUID(block.page)
        } as unknown as BlockEntity["page"];
    }
    if (block.parent?.id) {
        normalizedBlock.parent = {
            uuid: await resolveParentUUID(block.parent)
        } as unknown as BlockEntity["parent"];
    }

    if (Array.isArray(block.children)) {
        normalizedBlock.children = await Promise.all(
            block.children.map(async (child) => {
                if (isBlockEntity(child)) return await normalizeBlock(child);
                return child;
            })
        );
    }

    return normalizedBlock;
}
