import _ from "lodash";
import type {DeterminesticUUIDGenerator} from "../../DeterminesticUUIDGenerator";
import type {InMemoryDB, InMemoryLogseqEntity, LogseqEntityIdentity} from "../../types";
import {LogseqTransactionExecutor} from "../LogseqTransactionExecutor";
import {createInMemoryBlock, createInMemoryPage} from "./entityFactory";
import {
    detachBlock,
    findEntity,
    findPageContainingEntity,
    insertChild,
    isPageEntity,
    matchesIdentity,
    reparentSubtree
} from "./entityTree";
import {type InMemoryPageLoader, LogseqInMemoryPageLoader} from "./InMemoryPageLoader";
import {normalizeImportedPage} from "./normalizeLogseqEntity";

export class InMemoryExecutor extends LogseqTransactionExecutor {
    private readonly originalInMemoryPageDataDb: InMemoryDB = new Map();

    private readonly inMemoryPageDataDb: InMemoryDB = new Map();

    public constructor(
        uuidGenerator: DeterminesticUUIDGenerator,
        private readonly pageLoader: InMemoryPageLoader = new LogseqInMemoryPageLoader()
    ) {
        super(uuidGenerator);
    }

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

        const parentPage = findPageContainingEntity(this.inMemoryPageDataDb, parentBlockUUID);
        if (!parentPage) {
            throw new Error(`Failed to find parent page during insertBlock: ${parentBlockUUID}`);
        }

        const newBlock = createInMemoryBlock({
            uuid: this.uuidGenerator.getUUID(),
            content,
            parent,
            page: parentPage,
            now: Date.now()
        });
        insertChild(parent, newBlock);
        return this.pushAndReturn(_.cloneDeep(newBlock), true);
    }

    public async moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity
    ): Promise<boolean> {
        await this.importPageOfEntity(srcBlockUUID);
        await this.importPageOfEntity(destBlockUUID);

        const detachedBlock = detachBlock(this.inMemoryPageDataDb, srcBlockUUID);
        if (!detachedBlock) {
            throw new Error(`Failed to find source block during moveBlock: ${srcBlockUUID}`);
        }

        const destination = findEntity(this.inMemoryPageDataDb, destBlockUUID);
        if (!destination) {
            insertChild(detachedBlock.parent, detachedBlock.block);
            throw new Error(`Failed to find destination block during moveBlock: ${destBlockUUID}`);
        }

        const destinationPage = findPageContainingEntity(this.inMemoryPageDataDb, destBlockUUID);
        if (!destinationPage) {
            insertChild(detachedBlock.parent, detachedBlock.block);
            throw new Error(`Failed to find destination page during moveBlock: ${destBlockUUID}`);
        }

        reparentSubtree(detachedBlock.block, destination, destinationPage);
        insertChild(destination, detachedBlock.block);
        return this.pushAndReturn(true, true);
    }

    public async updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean> {
        const block = await this.getImportedEntity(blockUUID);
        if (!block || isPageEntity(block)) {
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
        const page = createInMemoryPage(
            this.uuidGenerator.getUUID(),
            pageName,
            properties,
            Date.now()
        );
        this.inMemoryPageDataDb.set(page.uuid, page);
        return this.pushAndReturn(_.cloneDeep(page), true);
    }

    public async deletePage(pageIdentity: LogseqEntityIdentity): Promise<boolean> {
        await this.importPageOfEntity(pageIdentity);

        const page = findPageContainingEntity(this.inMemoryPageDataDb, pageIdentity);
        if (!page || !matchesIdentity(page, pageIdentity)) {
            throw new Error(`Failed to find page during deletePage: ${pageIdentity}`);
        }

        this.inMemoryPageDataDb.delete(page.uuid);
        return this.pushAndReturn(true, true);
    }

    public async renamePage(pageIdentity: LogseqEntityIdentity, newName: string): Promise<boolean> {
        await this.importPageOfEntity(pageIdentity);

        const page = findPageContainingEntity(this.inMemoryPageDataDb, pageIdentity);
        if (!page || !matchesIdentity(page, pageIdentity)) {
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
            delete result.children;
        }
        return this.pushAndReturn(result, result);
    }

    private async importPageOfEntity(identity: LogseqEntityIdentity): Promise<void> {
        if (findPageContainingEntity(this.inMemoryPageDataDb, identity)) return;

        const loadedPage = await this.pageLoader.loadPageForIdentity(identity);
        if (!loadedPage || this.inMemoryPageDataDb.has(loadedPage.page.uuid)) return;

        const normalizedPage = normalizeImportedPage(loadedPage.page, loadedPage.blocks);
        this.originalInMemoryPageDataDb.set(normalizedPage.uuid, _.cloneDeep(normalizedPage));
        this.inMemoryPageDataDb.set(normalizedPage.uuid, _.cloneDeep(normalizedPage));
    }

    private async getImportedEntity(
        identity: LogseqEntityIdentity
    ): Promise<InMemoryLogseqEntity | null> {
        await this.importPageOfEntity(identity);
        return findEntity(this.inMemoryPageDataDb, identity);
    }
}
