import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {entityHasReference} from "../entityHasReference";

type PropertyEntity = NonNullable<Awaited<ReturnType<typeof LogseqEditor.getProperty>>>;

async function requireExistingTag(tagPageUuid: string): Promise<PageEntity> {
    const tag = await logseq.Editor.getTag(tagPageUuid);
    if (!tag) throw new Error(`Tag page not found: ${tagPageUuid}`);
    return tag;
}

async function requireExistingProperty(propertyPageUuid: string): Promise<PropertyEntity> {
    const property = await LogseqEditor.getProperty(propertyPageUuid);
    if (!property) throw new Error(`Property page not found: ${propertyPageUuid}`);
    return property;
}

function getTagProperties(tag: PageEntity): unknown {
    const tagRecord = tag as unknown as Record<string, unknown>;
    return (
        tagRecord[":logseq.property.class/properties"] ??
        tagRecord["logseq.property.class/properties"]
    );
}

async function requireTagPropertyRelationship(
    tagPageUuid: string,
    propertyPageUuid: string,
    expected: boolean
): Promise<void> {
    const [tag, property] = await Promise.all([
        requireExistingTag(tagPageUuid),
        requireExistingProperty(propertyPageUuid)
    ]);
    const hasProperty = entityHasReference(getTagProperties(tag), property);

    if (hasProperty !== expected) {
        throw new Error(
            expected
                ? `Tag page does not have property: ${propertyPageUuid}`
                : `Tag page already has property: ${propertyPageUuid}`
        );
    }
}

async function requireBlockTagRelationship(
    blockUuid: string,
    tagPageUuid: string,
    expected: boolean
): Promise<BlockEntity> {
    const [block, tag] = await Promise.all([
        logseq.Editor.getBlock(blockUuid),
        requireExistingTag(tagPageUuid)
    ]);
    if (!block) throw new Error(`Block not found: ${blockUuid}`);

    const hasTag = entityHasReference(block.tags, tag);
    if (hasTag !== expected) {
        throw new Error(
            expected
                ? `Block does not have tag: ${tagPageUuid}`
                : `Block already has tag: ${tagPageUuid}`
        );
    }

    return block;
}

export async function requireTagWithoutProperty(
    tagPageUuid: string,
    propertyPageUuid: string
): Promise<void> {
    await requireTagPropertyRelationship(tagPageUuid, propertyPageUuid, false);
}

export async function requireTagWithProperty(
    tagPageUuid: string,
    propertyPageUuid: string
): Promise<void> {
    await requireTagPropertyRelationship(tagPageUuid, propertyPageUuid, true);
}

export async function requireBlockWithoutTag(
    blockUuid: string,
    tagPageUuid: string
): Promise<BlockEntity> {
    return await requireBlockTagRelationship(blockUuid, tagPageUuid, false);
}

export async function requireBlockWithTag(
    blockUuid: string,
    tagPageUuid: string
): Promise<BlockEntity> {
    return await requireBlockTagRelationship(blockUuid, tagPageUuid, true);
}
