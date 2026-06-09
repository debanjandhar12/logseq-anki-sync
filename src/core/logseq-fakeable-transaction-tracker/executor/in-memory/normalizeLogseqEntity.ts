import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import type {InMemoryBlockEntity, InMemoryEntityReference, InMemoryPageEntity} from "../../types";

const DEFAULT_BLOCK_FORMAT: BlockEntity["format"] = "markdown";

export function normalizeImportedPage(page: PageEntity, blocks: BlockEntity[]): InMemoryPageEntity {
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
        children: blocks.map(normalizeImportedBlock)
    };
}

function normalizeImportedBlock(block: BlockEntity): InMemoryBlockEntity {
    const normalizedBlock = _.cloneDeep(block) as unknown as InMemoryBlockEntity;
    normalizedBlock.type = "block";
    normalizedBlock.format = DEFAULT_BLOCK_FORMAT;
    normalizedBlock.parent = normalizeReference(normalizedBlock.parent);
    normalizedBlock.page = normalizeReference(normalizedBlock.page);
    normalizedBlock.children = ((normalizedBlock.children || []) as unknown as BlockEntity[]).map(
        normalizeImportedBlock
    );
    return normalizedBlock;
}

function normalizeReference(reference: unknown): InMemoryEntityReference | undefined {
    if (typeof reference === "object" && reference !== null && "uuid" in reference) {
        const uuid = (reference as {uuid?: unknown}).uuid;
        return typeof uuid === "string" ? {uuid} : undefined;
    }

    return undefined;
}
