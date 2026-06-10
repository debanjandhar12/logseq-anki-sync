import type {
    InMemoryBlockEntity,
    InMemoryDB,
    InMemoryLogseqEntity,
    InMemoryPageEntity,
    LogseqEntityIdentity
} from "../../types";
import {toEntityReference} from "./entityFactory";

export type BlockDetachResult = {
    block: InMemoryBlockEntity;
    parent: InMemoryLogseqEntity;
};

export function findPageContainingEntity(
    db: InMemoryDB,
    identity: LogseqEntityIdentity
): InMemoryPageEntity | null {
    for (const page of db.values()) {
        if (matchesIdentity(page, identity)) return page;
        if (findBlockInChildren(page.children || [], identity)) return page;
    }

    return null;
}

export function findEntity(
    db: InMemoryDB,
    identity: LogseqEntityIdentity
): InMemoryLogseqEntity | null {
    for (const page of db.values()) {
        if (matchesIdentity(page, identity)) return page;

        const block = findBlockInChildren(page.children || [], identity);
        if (block) return block;
    }

    return null;
}

export function insertChild(parent: InMemoryLogseqEntity, child: InMemoryLogseqEntity): void {
    getMutableChildren(parent).push(child);
}

export function detachBlock(
    db: InMemoryDB,
    identity: LogseqEntityIdentity
): BlockDetachResult | null {
    for (const page of db.values()) {
        const detachedBlock = detachBlockFromParent(page, identity);
        if (detachedBlock) return detachedBlock;
    }

    return null;
}

export function reparentSubtree(
    block: InMemoryBlockEntity,
    parent: InMemoryLogseqEntity,
    page: InMemoryPageEntity
): void {
    block.parent = toEntityReference(parent);
    updateSubtreePage(block, page);
}

export function matchesIdentity(
    entity: InMemoryLogseqEntity,
    identity: LogseqEntityIdentity
): boolean {
    if (typeof identity === "number") return false;
    if (typeof identity === "string") {
        return entity.uuid === identity || (isPageEntity(entity) && entity.name === identity);
    }
    return Boolean(identity?.uuid && entity.uuid === identity.uuid);
}

export function isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
    return entity.type === "page";
}

function findBlockInChildren(
    children: InMemoryLogseqEntity[],
    identity: LogseqEntityIdentity
): InMemoryBlockEntity | null {
    for (const child of children) {
        if (isPageEntity(child)) continue;
        if (matchesIdentity(child, identity)) return child;

        const nestedChild = findBlockInChildren(child.children || [], identity);
        if (nestedChild) return nestedChild;
    }

    return null;
}

function detachBlockFromParent(
    parent: InMemoryLogseqEntity,
    identity: LogseqEntityIdentity
): BlockDetachResult | null {
    const children = getMutableChildren(parent);
    const childIndex = children.findIndex(
        (child) => !isPageEntity(child) && matchesIdentity(child, identity)
    );

    if (childIndex >= 0) {
        const [block] = children.splice(childIndex, 1);
        return {block: block as InMemoryBlockEntity, parent};
    }

    for (const child of children) {
        if (isPageEntity(child)) continue;
        const detachedBlock = detachBlockFromParent(child, identity);
        if (detachedBlock) return detachedBlock;
    }

    return null;
}

function updateSubtreePage(block: InMemoryBlockEntity, page: InMemoryPageEntity): void {
    block.page = toEntityReference(page);
    for (const child of block.children || []) {
        if (!isPageEntity(child)) {
            updateSubtreePage(child, page);
        }
    }
}

function getMutableChildren(entity: InMemoryLogseqEntity): InMemoryLogseqEntity[] {
    const mutableEntity = entity as {children?: InMemoryLogseqEntity[]};
    mutableEntity.children = mutableEntity.children || [];
    return mutableEntity.children;
}
