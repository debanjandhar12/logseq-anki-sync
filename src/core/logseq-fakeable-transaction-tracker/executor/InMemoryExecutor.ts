import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {LogseqPropertiesHelper} from "../../../logseq/LogseqPropertiesHelper";
import type {
    InMemoryBlockEntity,
    InMemoryDB,
    InMemoryLogseqEntity,
    InMemoryPageEntity,
    LogseqEntityIdentity
} from "../types";
import {LogseqTransactionExecutor} from "./LogseqTransactionExecutor";

type BlockDetachResult = {
    block: InMemoryBlockEntity;
    parent: InMemoryLogseqEntity;
};

export class InMemoryExecutor extends LogseqTransactionExecutor {
    private readonly originalInMemoryPageDataDb: InMemoryDB = new Map();

    private readonly inMemoryPageDataDb: InMemoryDB = new Map();

    public getInMemoryPageDataDb(): InMemoryDB {
        return this.inMemoryPageDataDb;
    }

    public getOriginalInMemoryPageDataDb(): InMemoryDB {
        return this.originalInMemoryPageDataDb;
    }

    private async importPageOfBlock(uuid: LogseqEntityIdentity): Promise<void> {
        const existingPage = this.findPageContainingEntity(uuid);
        if (existingPage) return;

        const page = await this.resolvePageForIdentity(uuid);
        if (!page) return;

        const pageUUID = page.uuid;
        if (this.inMemoryPageDataDb.has(pageUUID)) return;

        const pageBlocks = await LogseqPropertiesHelper.getPageBlocksTree(pageUUID);
        const pageWithChildren: InMemoryPageEntity = {
            ...page,
            children: pageBlocks
        };

        this.originalInMemoryPageDataDb.set(pageUUID, _.cloneDeep(pageWithChildren));
        this.inMemoryPageDataDb.set(pageUUID, _.cloneDeep(pageWithChildren));
    }

    private async resolvePageForIdentity(
        uuid: PageIdentity | BlockIdentity | EntityID
    ): Promise<PageEntity | null> {
        try {
            const page = await LogseqPropertiesHelper.getPage(uuid as PageIdentity | EntityID);
            if (page) return page;
        } catch (_error) {
            // Some in-memory-only entities do not exist in Logseq yet.
        }

        try {
            const block = await LogseqPropertiesHelper.getBlock(uuid as BlockIdentity | EntityID);
            if (!block?.page?.id) return null;
            return await LogseqPropertiesHelper.getPage(block.page.id);
        } catch (_error) {
            return null;
        }
    }

    private async getInMemoryDbBlock(
        blockUUID: LogseqEntityIdentity
    ): Promise<InMemoryLogseqEntity | null> {
        await this.importPageOfBlock(blockUUID);
        return this.findEntity(blockUUID);
    }

    private async getInMemoryPageTree(page: InMemoryPageEntity): Promise<InMemoryLogseqEntity[]> {
        const inMemoryPage = await this.getInMemoryDbBlock(page.uuid);
        if (!inMemoryPage || !this.isPageEntity(inMemoryPage)) {
            throw new Error(`Failed to find page tree in memory: ${page.uuid}`);
        }

        return this.getMutableChildren(inMemoryPage);
    }

    public async insertBlock(
        parentBlockUUID: LogseqEntityIdentity,
        content: string
    ): Promise<boolean> {
        const inMemoryParent = await this.getInMemoryDbBlock(parentBlockUUID);
        if (!inMemoryParent) {
            throw new Error(`Failed to find parent block during insertBlock: ${parentBlockUUID}`);
        }

        const parentPage = this.findPageContainingEntity(parentBlockUUID);
        if (!parentPage) {
            throw new Error(`Failed to find parent page during insertBlock: ${parentBlockUUID}`);
        }

        const now = Date.now();
        const newBlock: InMemoryBlockEntity = {
            id: -now,
            uuid: this.uuidGenerator.getUUID(),
            order: String((inMemoryParent.children || []).length),
            format: this.getEntityFormat(inMemoryParent),
            parent: {id: inMemoryParent.id},
            title: content,
            fullTitle: content,
            content,
            page: {id: parentPage.id},
            createdAt: now,
            updatedAt: now,
            properties: {},
            "collapsed?": false,
            children: []
        };

        this.getMutableChildren(inMemoryParent).push(newBlock);
        return this.pushAndReturn(newBlock, true);
    }

    public async moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity
    ): Promise<boolean> {
        await this.importPageOfBlock(srcBlockUUID);
        await this.importPageOfBlock(destBlockUUID);

        const detachedBlock = this.detachBlock(srcBlockUUID);
        if (!detachedBlock) {
            throw new Error(`Failed to find source block during moveBlock: ${srcBlockUUID}`);
        }

        const destination = this.findEntity(destBlockUUID);
        if (!destination) {
            this.getMutableChildren(detachedBlock.parent).push(detachedBlock.block);
            throw new Error(`Failed to find destination block during moveBlock: ${destBlockUUID}`);
        }

        const destinationPage = this.findPageContainingEntity(destBlockUUID);
        if (!destinationPage) {
            throw new Error(`Failed to find destination page during moveBlock: ${destBlockUUID}`);
        }

        detachedBlock.block.parent = {id: destination.id};
        detachedBlock.block.page = {id: destinationPage.id};
        this.getMutableChildren(destination).push(detachedBlock.block);
        return this.pushAndReturn(true, true);
    }

    public async updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean> {
        const inMemoryBlock = await this.getInMemoryDbBlock(blockUUID);
        if (!inMemoryBlock) {
            throw new Error(`Failed to find block during updateBlock: ${blockUUID}`);
        }

        inMemoryBlock.content = content;
        inMemoryBlock.title = content;
        inMemoryBlock.fullTitle = content;
        inMemoryBlock.updatedAt = Date.now();
        return this.pushAndReturn(true, true);
    }

    public async createPage(
        pageName: string,
        properties: Record<string, any> = {}
    ): Promise<boolean> {
        const now = Date.now();
        const pageUUID = this.uuidGenerator.getUUID();
        const page: InMemoryPageEntity = {
            id: -now,
            uuid: pageUUID,
            name: pageName,
            title: pageName,
            format: "markdown",
            type: "page",
            updatedAt: now,
            createdAt: now,
            "journal?": false,
            properties,
            children: []
        };

        this.inMemoryPageDataDb.set(pageUUID, page);
        return this.pushAndReturn(page, true);
    }

    public async deletePage(pageUuid: LogseqEntityIdentity): Promise<boolean> {
        await this.importPageOfBlock(pageUuid);

        const page = this.findPageContainingEntity(pageUuid);
        if (!page) {
            throw new Error(`Failed to find page during deletePage: ${pageUuid}`);
        }

        await this.getInMemoryPageTree(page);
        this.inMemoryPageDataDb.delete(page.uuid);
        return this.pushAndReturn(true, true);
    }

    public async renamePage(pageUuid: LogseqEntityIdentity, newName: string): Promise<boolean> {
        await this.importPageOfBlock(pageUuid);

        const page = this.findPageContainingEntity(pageUuid);
        if (!page) {
            throw new Error(`Failed to find page during renamePage: ${pageUuid}`);
        }

        page.name = newName;
        page.title = newName;
        page.originalName = newName;
        page.updatedAt = Date.now();
        return this.pushAndReturn(true, true);
    }

    public async readBlockOrPage(
        uuid: LogseqEntityIdentity,
        includeChildren: boolean
    ): Promise<InMemoryLogseqEntity | null> {
        const entity = await this.getInMemoryDbBlock(uuid);
        if (!entity) return null;

        const result = _.cloneDeep(entity);
        if (!includeChildren) {
            delete (result as {children?: InMemoryLogseqEntity[]}).children;
        }
        return this.pushAndReturn(result, result);
    }

    private findPageContainingEntity(pageUuid: LogseqEntityIdentity): InMemoryPageEntity | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            if (this.matchesIdentity(page, pageUuid)) return page;
            if (this.findBlockInChildren(page.children || [], pageUuid)) return page;
        }

        return null;
    }

    private findEntity(uuid: LogseqEntityIdentity): InMemoryLogseqEntity | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            if (this.matchesIdentity(page, uuid)) return page;

            const block = this.findBlockInChildren(page.children || [], uuid);
            if (block) return block;
        }

        return null;
    }

    private findBlockInChildren(
        children: InMemoryLogseqEntity[],
        blockUuid: LogseqEntityIdentity
    ): InMemoryBlockEntity | null {
        for (const child of children) {
            if (this.isPageEntity(child)) continue;
            if (this.matchesIdentity(child, blockUuid)) return child;

            const nestedChild = this.findBlockInChildren(
                (child.children || []) as InMemoryLogseqEntity[],
                blockUuid
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
        const children = (parent.children || []) as InMemoryLogseqEntity[];
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
        if (typeof identity === "number") return entity.id === identity;
        if (typeof identity === "string") {
            return entity.uuid === identity;
        }

        return Boolean(identity?.uuid && entity.uuid === identity.uuid);
    }

    private isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
        return "name" in entity && "type" in entity;
    }

    private getEntityFormat(entity: InMemoryLogseqEntity): BlockEntity["format"] {
        return entity.format === "org" ? "org" : "markdown";
    }

    private getMutableChildren(entity: InMemoryLogseqEntity): InMemoryLogseqEntity[] {
        const mutableEntity = entity as {children?: InMemoryLogseqEntity[]};
        mutableEntity.children = mutableEntity.children || [];
        return mutableEntity.children;
    }
}
