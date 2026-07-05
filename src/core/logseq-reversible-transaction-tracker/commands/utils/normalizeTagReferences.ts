import type {BlockEntity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {getEntityID} from "src/core/logseq-reversible-transaction-tracker/commands/utils/getEntityID";

export type NormalizedTagReference = {
    uuid: string;
    tagName: string;
};

type EntityReferenceWithUUID = {
    uuid: string;
    name?: string;
    originalName?: string;
    title?: string;
    content?: string;
};

function getTagName(tag: EntityReferenceWithUUID): string {
    return tag.originalName ?? tag.name ?? tag.title ?? tag.content ?? tag.uuid;
}

async function resolveTagReference(tagReference: unknown): Promise<NormalizedTagReference> {
    if (typeof tagReference === "object" && tagReference !== null && "uuid" in tagReference) {
        const tag = tagReference as EntityReferenceWithUUID;
        return {uuid: tag.uuid, tagName: getTagName(tag)};
    }

    const id = getEntityID(tagReference);
    if (id === undefined) {
        throw new Error(
            `Tag reference is missing a UUID or numeric id: ${JSON.stringify(tagReference)}`
        );
    }

    const tag = (await logseq.Editor.getBlock(id)) as (BlockEntity | PageEntity) &
        EntityReferenceWithUUID;
    if (!tag?.uuid) throw new Error(`Unable to resolve tag reference: ${id}`);

    return {uuid: tag.uuid, tagName: getTagName(tag)};
}

/**
 * Used in normalizeBlock / normalizePage etc to convert block.tags from an array of entity ids to
 * an array of {uuid, tagName}
 * @param entity
 */
export async function normalizeTagReferences<T extends object>(entity: T): Promise<T> {
    const record = entity as Record<string, unknown>;
    if (!Array.isArray(record.tags)) return entity;

    record.tags = await Promise.all(record.tags.map(resolveTagReference));
    return entity;
}