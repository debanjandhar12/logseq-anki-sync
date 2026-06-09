import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import type {
    InMemoryBlockEntity,
    InMemoryDB,
    InMemoryEntityReference,
    InMemoryLogseqEntity,
    InMemoryPageEntity,
    LogseqEntityIdentity
} from "../types";
import {LogseqTransactionExecutor} from "./LogseqTransactionExecutor";

type BlockDetachResult = {
    block: InMemoryBlockEntity;
    parent: InMemoryLogseqEntity;
};

const DEFAULT_BLOCK_FORMAT: BlockEntity["format"] = "markdown";

export class InMemoryExecutor extends LogseqTransactionExecutor {
    private readonly originalInMemoryPageDataDb: InMemoryDB = new Map();

    private readonly inMemoryPageDataDb: InMemoryDB = new Map();

    public getInMemoryPageDataDb(): InMemoryDB {
        return this.inMemoryPageDataDb;
    }

    public getOriginalInMemoryPageDataDb(): InMemoryDB {
        return this.originalInMemoryPageDataDb;
    }

    public async insertBlock(
        parentBlockUUID: LogseqEntityIdentity,
        content: string
    ): Promise<boolean> {
        const parent = await this.getImportedEntity(parentBlockUUID);
        if (!parent) {
            throw new Error(`Failed to find parent block during insertBlock: ${parentBlockUUID}`);
        }

        const parentPage = this.findPageContainingEntity(parentBlockUUID);
        if (!parentPage) {
            throw new Error(`Failed to find parent page during insertBlock: ${parentBlockUUID}`);
        }

        const newBlock = this.createBlock({content, parent, page: parentPage});
        this.insertChild(parent, newBlock);
        return this.pushAndReturn(_.cloneDeep(newBlock), true);
    }

    public async moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity
    ): Promise<boolean> {
        await this.importPageOfEntity(srcBlockUUID);
        await this.importPageOfEntity(destBlockUUID);

        const detachedBlock = this.detachBlock(srcBlockUUID);
        if (!detachedBlock) {
            throw new Error(`Failed to find source block during moveBlock: ${srcBlockUUID}`);
        }

        const destination = this.findEntity(destBlockUUID);
        if (!destination) {
            this.insertChild(detachedBlock.parent, detachedBlock.block);
            throw new Error(`Failed to find destination block during moveBlock: ${destBlockUUID}`);
        }

        const destinationPage = this.findPageContainingEntity(destBlockUUID);
        if (!destinationPage) {
            this.insertChild(detachedBlock.parent, detachedBlock.block);
            throw new Error(`Failed to find destination page during moveBlock: ${destBlockUUID}`);
        }

        this.reparentSubtree(detachedBlock.block, destination, destinationPage);
        this.insertChild(destination, detachedBlock.block);
        return this.pushAndReturn(true, true);
    }

    public async updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean> {
        const block = await this.getImportedEntity(blockUUID);
        if (!block || this.isPageEntity(block)) {
            throw new Error(`Failed to find block during updateBlock: ${blockUUID}`);
        }

        block.content = content;
        block.title = content;
        block.fullTitle = content;
        block.updatedAt = Date.now();
        return this.pushAndReturn(true, true);
    }

    public async createPage(
        pageName: string,
        properties: Record<string, any> = {}
    ): Promise<boolean> {
        const now = Date.now();
        const pageUuid = this.uuidGenerator.getUUID();
        const page: InMemoryPageEntity = {
            uuid: pageUuid,
            name: pageName,
            title: pageName,
            fullTitle: pageName,
            content: pageName,
            format: DEFAULT_BLOCK_FORMAT,
            type: "page",
            updatedAt: now,
            createdAt: now,
            "journal?": false,
            properties: {...properties, uuid: pageUuid},
            children: []
        };

        this.inMemoryPageDataDb.set(page.uuid, page);
        return this.pushAndReturn(_.cloneDeep(page), true);
    }

    public async deletePage(pageIdentity: LogseqEntityIdentity): Promise<boolean> {
        await this.importPageOfEntity(pageIdentity);

        const page = this.findPageContainingEntity(pageIdentity);
        if (!page || !this.matchesIdentity(page, pageIdentity)) {
            throw new Error(`Failed to find page during deletePage: ${pageIdentity}`);
        }

        this.inMemoryPageDataDb.delete(page.uuid);
        return this.pushAndReturn(true, true);
    }

    public async renamePage(pageIdentity: LogseqEntityIdentity, newName: string): Promise<boolean> {
        await this.importPageOfEntity(pageIdentity);

        const page = this.findPageContainingEntity(pageIdentity);
        if (!page || !this.matchesIdentity(page, pageIdentity)) {
            throw new Error(`Failed to find page during renamePage: ${pageIdentity}`);
        }

        page.name = newName;
        page.title = newName;
        page.fullTitle = newName;
        page.content = newName;
        page.originalName = newName;
        page.updatedAt = Date.now();
        return this.pushAndReturn(true, true);
    }

    public async readBlockOrPage(
        uuid: LogseqEntityIdentity,
        includeChildren: boolean
    ): Promise<InMemoryLogseqEntity | null> {
        const entity = await this.getImportedEntity(uuid);
        if (!entity) return null;

        const result = _.cloneDeep(entity);
        if (!includeChildren) {
            delete (result as {children?: InMemoryLogseqEntity[]}).children;
        }
        return this.pushAndReturn(result, result);
    }

    private async importPageOfEntity(identity: LogseqEntityIdentity): Promise<void> {
        const existingPage = this.findPageContainingEntity(identity);
        if (existingPage) return;

        const page = await this.resolvePageForIdentity(identity);
        if (!page || this.inMemoryPageDataDb.has(page.uuid)) return;

        const pageBlocks = await LogseqPropertiesHelper.getPageBlocksTree(page.uuid);
        const pageWithChildren: InMemoryPageEntity = {
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
            children: this.normalizeImportedBlocks(pageBlocks)
        };

        this.originalInMemoryPageDataDb.set(page.uuid, _.cloneDeep(pageWithChildren));
        this.inMemoryPageDataDb.set(page.uuid, _.cloneDeep(pageWithChildren));
    }

    private async resolvePageForIdentity(
        identity: PageIdentity | BlockIdentity | EntityID
    ): Promise<PageEntity | null> {
        try {
            const page = await LogseqPropertiesHelper.getPage(identity as PageIdentity | EntityID);
            if (page) return page;
        } catch (_error) {
            // In-memory-only entities do not exist in Logseq yet.
        }

        try {
            const block = await LogseqPropertiesHelper.getBlock(
                identity as BlockIdentity | EntityID
            );
            const pageId = this.getReferenceId(block?.page);
            if (!pageId) return null;
            return await LogseqPropertiesHelper.getPage(pageId);
        } catch (_error) {
            return null;
        }
    }

    private async getImportedEntity(
        identity: LogseqEntityIdentity
    ): Promise<InMemoryLogseqEntity | null> {
        await this.importPageOfEntity(identity);
        return this.findEntity(identity);
    }

    private createBlock({
        content,
        parent,
        page
    }: {
        content: string;
        parent: InMemoryLogseqEntity;
        page: InMemoryPageEntity;
    }): InMemoryBlockEntity {
        const now = Date.now();
        const blockUuid = this.uuidGenerator.getUUID();
        return {
            uuid: blockUuid,
            type: "block",
            format: DEFAULT_BLOCK_FORMAT,
            parent: this.toEntityReference(parent),
            title: content,
            fullTitle: content,
            content,
            page: this.toEntityReference(page),
            createdAt: now,
            updatedAt: now,
            properties: {uuid: blockUuid},
            "collapsed?": false,
            children: []
        } as InMemoryBlockEntity;
    }

    private insertChild(parent: InMemoryLogseqEntity, child: InMemoryLogseqEntity): void {
        this.getMutableChildren(parent).push(child);
    }

    private normalizeImportedBlocks(blocks: BlockEntity[]): InMemoryBlockEntity[] {
        return blocks.map((block) => this.normalizeImportedBlock(block));
    }

    private normalizeImportedBlock(block: BlockEntity): InMemoryBlockEntity {
        const normalizedBlock = _.cloneDeep(block) as unknown as InMemoryBlockEntity;
        normalizedBlock.type = "block";
        normalizedBlock.format = DEFAULT_BLOCK_FORMAT;
        normalizedBlock.parent = this.normalizeReference(normalizedBlock.parent);
        normalizedBlock.page = this.normalizeReference(normalizedBlock.page);
        normalizedBlock.children = this.normalizeImportedBlocks(
            (normalizedBlock.children || []) as unknown as BlockEntity[]
        );
        return normalizedBlock;
    }

    private normalizeReference(reference: unknown): InMemoryEntityReference | undefined {
        if (typeof reference === "object" && reference !== null && "uuid" in reference) {
            const uuid = (reference as {uuid?: unknown}).uuid;
            return typeof uuid === "string" ? {uuid} : undefined;
        }

        return undefined;
    }

    private getReferenceId(reference: unknown): EntityID | undefined {
        if (typeof reference === "number") return reference;
        if (typeof reference === "object" && reference !== null && "id" in reference) {
            const id = (reference as {id?: unknown}).id;
            return typeof id === "number" ? id : undefined;
        }
        return undefined;
    }

    private reparentSubtree(
        block: InMemoryBlockEntity,
        parent: InMemoryLogseqEntity,
        page: InMemoryPageEntity
    ): void {
        block.parent = this.toEntityReference(parent);
        this.updateSubtreePage(block, page);
    }

    private updateSubtreePage(block: InMemoryBlockEntity, page: InMemoryPageEntity): void {
        block.page = this.toEntityReference(page);
        for (const child of (block.children || []) as InMemoryLogseqEntity[]) {
            if (!this.isPageEntity(child)) {
                this.updateSubtreePage(child as InMemoryBlockEntity, page);
            }
        }
    }

    private toEntityReference(entity: InMemoryLogseqEntity): InMemoryEntityReference {
        return {uuid: entity.uuid};
    }

    private findPageContainingEntity(identity: LogseqEntityIdentity): InMemoryPageEntity | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            if (this.matchesIdentity(page, identity)) return page;
            if (this.findBlockInChildren(page.children || [], identity)) return page;
        }

        return null;
    }

    private findEntity(identity: LogseqEntityIdentity): InMemoryLogseqEntity | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            if (this.matchesIdentity(page, identity)) return page;

            const block = this.findBlockInChildren(page.children || [], identity);
            if (block) return block;
        }

        return null;
    }

    private findBlockInChildren(
        children: InMemoryLogseqEntity[],
        identity: LogseqEntityIdentity
    ): InMemoryBlockEntity | null {
        for (const child of children) {
            if (this.isPageEntity(child)) continue;
            if (this.matchesIdentity(child, identity)) return child;

            const nestedChild = this.findBlockInChildren(
                (child.children || []) as InMemoryLogseqEntity[],
                identity
            );
            if (nestedChild) return nestedChild;
        }

        return null;
    }

    private detachBlock(identity: LogseqEntityIdentity): BlockDetachResult | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            const detachedBlock = this.detachBlockFromParent(page, identity);
            if (detachedBlock) return detachedBlock;
        }

        return null;
    }

    private detachBlockFromParent(
        parent: InMemoryLogseqEntity,
        identity: LogseqEntityIdentity
    ): BlockDetachResult | null {
        const children = this.getMutableChildren(parent);
        const childIndex = children.findIndex(
            (child) => !this.isPageEntity(child) && this.matchesIdentity(child, identity)
        );

        if (childIndex >= 0) {
            const [block] = children.splice(childIndex, 1);
            return {block: block as InMemoryBlockEntity, parent};
        }

        for (const child of children) {
            if (this.isPageEntity(child)) continue;
            const detachedBlock = this.detachBlockFromParent(child, identity);
            if (detachedBlock) return detachedBlock;
        }

        return null;
    }

    private matchesIdentity(entity: InMemoryLogseqEntity, identity: LogseqEntityIdentity): boolean {
        if (typeof identity === "number") return false;
        if (typeof identity === "string")
            return entity.uuid === identity || this.getPageName(entity) === identity;
        return Boolean(identity?.uuid && entity.uuid === identity.uuid);
    }

    private getPageName(entity: InMemoryLogseqEntity): string | undefined {
        return this.isPageEntity(entity) ? entity.name : undefined;
    }

    private isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
        return entity.type === "page";
    }
    private getMutableChildren(entity: InMemoryLogseqEntity): InMemoryLogseqEntity[] {
        const mutableEntity = entity as {children?: InMemoryLogseqEntity[]};
        mutableEntity.children = mutableEntity.children || [];
        return mutableEntity.children;
    }
}
