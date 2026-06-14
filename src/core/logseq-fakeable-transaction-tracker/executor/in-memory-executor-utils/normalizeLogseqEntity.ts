import type {BlockEntity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import type {InMemoryBlockEntity, InMemoryEntityReference, InMemoryPageEntity} from "../../types";

const DEFAULT_BLOCK_FORMAT: BlockEntity["format"] = "markdown";

export async function normalizeImportedPage(
    page: PageEntity,
    blocks: BlockEntity[]
): Promise<InMemoryPageEntity> {
    return {
        uuid: page.uuid,
        name: page.name,
        title: typeof page.title === "string" ? page.title : page.name,
        fullTitle: typeof page.fullTitle === "string" ? page.fullTitle : page.name,
        content: typeof page.content === "string" ? page.content : page.name,
        format: DEFAULT_BLOCK_FORMAT,
        type: "page",
        updatedAt: page.updatedAt,
        createdAt: page.createdAt,
        "journal?": page["journal?"],
        properties: page.properties,
        originalName: page.originalName,
        children: await Promise.all(blocks.map(normalizeImportedBlock))
    };
}

async function normalizeImportedBlock(block: BlockEntity): Promise<InMemoryBlockEntity> {
    const normalizedBlock = _.cloneDeep(block) as unknown as InMemoryBlockEntity;
    normalizedBlock.type = "block";
    normalizedBlock.format = DEFAULT_BLOCK_FORMAT;
    normalizedBlock.parent = await normalizeAndResolveUUIDObject(normalizedBlock.parent);
    normalizedBlock.page = await normalizeAndResolveUUIDObject(normalizedBlock.page);
    normalizedBlock.children = await Promise.all(
        ((normalizedBlock.children || []) as unknown as BlockEntity[]).map(normalizeImportedBlock)
    );
    return normalizedBlock;
}

async function normalizeAndResolveUUIDObject(
    reference: unknown
): Promise<InMemoryEntityReference | undefined> {
    if (typeof reference === "number") {
        return getBlockUUIDReference(reference);
    }

    if (typeof reference === "object" && reference !== null && "uuid" in reference) {
        const uuid = (reference as {uuid?: unknown}).uuid;
        return typeof uuid === "string" ? {uuid} : undefined;
    }

    if (typeof reference === "object" && reference !== null && "id" in reference) {
        const id = (reference as {id?: unknown}).id;
        return typeof id === "number" ? getBlockUUIDReference(id) : undefined;
    }

    return undefined;
}

async function getBlockUUIDReference(id: EntityID): Promise<InMemoryEntityReference | undefined> {
    const block = await LogseqPropertiesHelper.getBlock(id);
    return block?.uuid ? {uuid: block.uuid} : undefined;
}
