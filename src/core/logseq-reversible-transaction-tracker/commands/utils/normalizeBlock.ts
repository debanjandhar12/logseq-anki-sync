import type {BlockEntity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {getEntityID} from "src/core/logseq-reversible-transaction-tracker/commands/utils/getEntityID";
import {LogseqAppInfoFetcher} from "src/logseq/LogseqAppInfoFetcher";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {normalizeTagReferences} from "./normalizeTagReferences";
import {removeRefFromObj} from "./removeRefFromObj";

type EntityReferenceWithID = {id: EntityID};
type EntityReferenceWithUUID = {uuid: string};
export type ResolvableEntityReference = EntityID | EntityReferenceWithID | EntityReferenceWithUUID;

function hasUUID(value: unknown): value is EntityReferenceWithUUID {
    return typeof value === "object" && value !== null && "uuid" in value;
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

    if (await LogseqAppInfoFetcher.checkCurrentIsDbGraph()) {
        const properties = await logseq.Editor.getBlockProperties(block.uuid);
        if (properties) block.properties = {...properties, ...block.properties};
        // TODO: Link is not actually a property. This may cause confusion with llm.
        // Logseq likely doesnt provide any api for handling references...
        if (block.link) block.properties = {...block.properties, link: block.link};
    }

    const normalizedBlock = await normalizeTagReferences(removeRefFromObj(block));
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
