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
    index: number;
};

export type ParentAndIndex = {
    parent: InMemoryLogseqEntity;
    index: number;
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

export function insertChildAt(
    parent: InMemoryLogseqEntity,
    child: InMemoryLogseqEntity,
    index: number
): void {
    getMutableChildren(parent).splice(index, 0, child);
}

export function insertSibling(
    db: InMemoryDB,
    targetIdentity: LogseqEntityIdentity,
    child: InMemoryLogseqEntity,
    before: boolean
): void {
    const target = findParentAndIndex(db, targetIdentity);
    if (!target) {
        throw new Error(`Failed to find sibling target during insertBlock: ${targetIdentity}`);
    }

    insertChildAt(target.parent, child, before ? target.index : target.index + 1);
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

export function isDescendantOf(
    entity: InMemoryLogseqEntity,
    possibleAncestor: InMemoryLogseqEntity
): boolean {
    for (const child of possibleAncestor.children || []) {
        if (child === entity || matchesIdentity(child, entity.uuid)) return true;
        if (isDescendantOf(entity, child)) return true;
    }

    return false;
}

export function findParentOfEntity(
    db: InMemoryDB,
    identity: LogseqEntityIdentity
): InMemoryLogseqEntity | null {
    return findParentAndIndex(db, identity)?.parent ?? null;
}

export function findParentAndIndex(
    db: InMemoryDB,
    identity: LogseqEntityIdentity
): ParentAndIndex | null {
    for (const page of db.values()) {
        const parentAndIndex = findParentAndIndexInChildren(page, identity);
        if (parentAndIndex) return parentAndIndex;
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
        return {block: block as InMemoryBlockEntity, parent, index: childIndex};
    }

    for (const child of children) {
        if (isPageEntity(child)) continue;
        const detachedBlock = detachBlockFromParent(child, identity);
        if (detachedBlock) return detachedBlock;
    }

    return null;
}

function findParentAndIndexInChildren(
    parent: InMemoryLogseqEntity,
    identity: LogseqEntityIdentity
): ParentAndIndex | null {
    const children = parent.children || [];
    const childIndex = children.findIndex((child) => matchesIdentity(child, identity));

    if (childIndex >= 0) return {parent, index: childIndex};

    for (const child of children) {
        const parentAndIndex = findParentAndIndexInChildren(child, identity);
        if (parentAndIndex) return parentAndIndex;
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
