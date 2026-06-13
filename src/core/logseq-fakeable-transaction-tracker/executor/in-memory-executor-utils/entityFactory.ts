import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import type {
    InMemoryBlockEntity,
    InMemoryEntityReference,
    InMemoryLogseqEntity,
    InMemoryPageEntity
} from "../../types";

const DEFAULT_BLOCK_FORMAT: BlockEntity["format"] = "markdown";

export function createInMemoryPage(
    pageUuid: string,
    pageName: string,
    properties: Record<string, any>,
    now: number,
    pageType: InMemoryPageEntity["pageType"] = "page"
): InMemoryPageEntity {
    return {
        uuid: pageUuid,
        name: pageName,
        title: pageName,
        fullTitle: pageName,
        content: pageName,
        format: DEFAULT_BLOCK_FORMAT,
        type: "page",
        pageType,
        updatedAt: now,
        createdAt: now,
        "journal?": false,
        properties: {...properties, uuid: pageUuid},
        children: []
    };
}

export function createInMemoryBlock({
    uuid,
    content,
    parent,
    page,
    now
}: {
    uuid: string;
    content: string;
    parent: InMemoryLogseqEntity;
    page: InMemoryPageEntity;
    now: number;
}): InMemoryBlockEntity {
    return {
        uuid,
        type: "block",
        format: DEFAULT_BLOCK_FORMAT,
        parent: toEntityReference(parent),
        title: content,
        fullTitle: content,
        content,
        page: toEntityReference(page),
        createdAt: now,
        updatedAt: now,
        properties: {uuid},
        "collapsed?": false,
        children: []
    } as InMemoryBlockEntity;
}

export function toEntityReference(entity: InMemoryLogseqEntity): InMemoryEntityReference {
    return {uuid: entity.uuid};
}
