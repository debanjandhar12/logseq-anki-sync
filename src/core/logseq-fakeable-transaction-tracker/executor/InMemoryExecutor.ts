import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import type {DeterminesticUUIDGenerator} from "../DeterminesticUUIDGenerator";
import type {
    InMemoryBlockEntity,
    InMemoryDB,
    InMemoryLogseqEntity,
    InMemoryMetadataDB,
    LogseqEntityIdentity
} from "../types";
import {createInMemoryBlock, createInMemoryPage} from "./in-memory-executor-utils/entityFactory";
import {
    detachBlock,
    findEntity,
    findPageContainingEntity,
    findParentOfEntity,
    insertChild,
    insertChildAt,
    insertSibling,
    isDescendantOf,
    isPageEntity,
    matchesIdentity,
    reparentSubtree
} from "./in-memory-executor-utils/entityTree";
import {
    type InMemoryPageLoader,
    LogseqInMemoryPageLoader
} from "./in-memory-executor-utils/InMemoryPageLoader";
import {
    createInMemoryMetadataDb,
    removePropertyFromEntities
} from "./in-memory-executor-utils/metadataStore";
import {normalizeImportedPage} from "./in-memory-executor-utils/normalizeLogseqEntity";
import {
    DEFAULT_INSERT_BLOCK_OPTIONS,
    DEFAULT_MOVE_BLOCK_OPTIONS,
    type InsertBlockOptions,
    LogseqTransactionExecutor,
    type MoveBlockOptions
} from "./LogseqTransactionExecutor";

export type {InMemoryPageLoader} from "./in-memory-executor-utils/InMemoryPageLoader";

export class InMemoryExecutor extends LogseqTransactionExecutor {
    private readonly originalInMemoryPageDataDb: InMemoryDB = new Map();

    private readonly inMemoryPageDataDb: InMemoryDB = new Map();

    private readonly originalInMemoryMetadataDb: InMemoryMetadataDB = createInMemoryMetadataDb();

    private readonly inMemoryMetadataDb: InMemoryMetadataDB = createInMemoryMetadataDb();

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

    public getInMemoryMetadataDb(): InMemoryMetadataDB {
        return this.inMemoryMetadataDb;
    }

    public getOriginalInMemoryMetadataDb(): InMemoryMetadataDB {
        return this.originalInMemoryMetadataDb;
    }

    public async insertBlock(
        parentBlockUUID: LogseqEntityIdentity,
        content: string,
        options: InsertBlockOptions = DEFAULT_INSERT_BLOCK_OPTIONS
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
        if (options.sibling) {
            const siblingParent = findParentOfEntity(this.inMemoryPageDataDb, parentBlockUUID);
            if (!siblingParent) {
                throw new Error(
                    `Failed to find sibling parent during insertBlock: ${parentBlockUUID}`
                );
            }

            reparentSubtree(newBlock, siblingParent, parentPage);
            insertSibling(
                this.inMemoryPageDataDb,
                parentBlockUUID,
                newBlock,
                options.before === true
            );
        } else if (
            options.start ||
            (options.before && (parent.children?.length || isPageEntity(parent)))
        ) {
            insertChildAt(parent, newBlock, 0);
        } else if (options.before) {
            const siblingParent = findParentOfEntity(this.inMemoryPageDataDb, parentBlockUUID);
            if (!siblingParent) {
                throw new Error(
                    `Failed to find sibling parent during insertBlock: ${parentBlockUUID}`
                );
            }

            reparentSubtree(newBlock, siblingParent, parentPage);
            insertSibling(this.inMemoryPageDataDb, parentBlockUUID, newBlock, true);
        } else {
            insertChild(parent, newBlock);
        }

        return this.pushAndReturn(_.cloneDeep(newBlock), true);
    }

    public async moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity,
        options: MoveBlockOptions = DEFAULT_MOVE_BLOCK_OPTIONS
    ): Promise<boolean> {
        if (options.children === false) {
            throw new Error(
                "moveBlock with children: false is not supported by the in-memory executor"
            );
        }

        await this.importPageOfEntity(srcBlockUUID);
        await this.importPageOfEntity(destBlockUUID);

        const source = findEntity(this.inMemoryPageDataDb, srcBlockUUID);
        if (!source || isPageEntity(source)) {
            throw new Error(`Failed to find source block during moveBlock: ${srcBlockUUID}`);
        }

        const destination = findEntity(this.inMemoryPageDataDb, destBlockUUID);
        if (!destination || isPageEntity(destination)) {
            throw new Error(`Failed to find destination block during moveBlock: ${destBlockUUID}`);
        }

        if (isDescendantOf(destination, source)) {
            throw new Error("Cannot move a block inside its own subtree");
        }

        const destinationPage = findPageContainingEntity(this.inMemoryPageDataDb, destBlockUUID);
        if (!destinationPage) {
            throw new Error(`Failed to find destination page during moveBlock: ${destBlockUUID}`);
        }

        const destinationParent = findParentOfEntity(this.inMemoryPageDataDb, destBlockUUID);
        if (options.before && !destinationParent) {
            throw new Error(`Failed to find destination parent during moveBlock: ${destBlockUUID}`);
        }

        const detachedBlock = detachBlock(this.inMemoryPageDataDb, srcBlockUUID);
        if (!detachedBlock) {
            throw new Error(`Failed to find source block during moveBlock: ${srcBlockUUID}`);
        }

        if (options.before) {
            reparentSubtree(
                detachedBlock.block,
                destinationParent as InMemoryLogseqEntity,
                destinationPage
            );
            insertSibling(this.inMemoryPageDataDb, destBlockUUID, detachedBlock.block, true);
        } else {
            reparentSubtree(detachedBlock.block, destination, destinationPage);
            insertChild(destination, detachedBlock.block);
        }

        return this.pushAndReturn(true, true);
    }

    public async updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean> {
        const block = await this.getImportedEntity(blockUUID);
        if (!block || isPageEntity(block)) {
            throw new Error(`Failed to find block during updateBlock: ${blockUUID}`);
        }

        const inMemoryBlock = block as InMemoryBlockEntity;
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
        const existingPage = await this.findPageByName(pageName);
        if (existingPage) {
            throw new Error(`Page already exists: ${pageName}`);
        }

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

        const existingPage = await this.findPageByName(newName);
        if (existingPage && existingPage.uuid !== page.uuid) {
            throw new Error(`Page already exists: ${newName}`);
        }

        page.name = newName;
        page.title = newName;
        page.fullTitle = newName;
        page.content = newName;
        page.originalName = newName;
        page.updatedAt = Date.now();
        return this.pushAndReturn(true, true);
    }

    public async upsertProperty(
        key: string,
        schema: Partial<PropertySchema> = {},
        options: {name?: string} = {}
    ): Promise<boolean> {
        const existingDefinition = this.inMemoryMetadataDb.properties.get(key);
        if (existingDefinition) {
            existingDefinition.schema = {...existingDefinition.schema, ...schema};
            if (options.name !== undefined) {
                existingDefinition.name = options.name;
            }
        } else {
            this.inMemoryMetadataDb.properties.set(key, {
                uuid: this.uuidGenerator.getUUID(),
                key,
                name: options.name,
                type: "property",
                schema: {...schema},
                properties: {}
            });
        }

        return this.pushAndReturn(true, true);
    }

    public async removeProperty(key: string): Promise<boolean> {
        this.assertMutablePropertyKey(key);
        this.inMemoryMetadataDb.properties.delete(key);
        removePropertyFromEntities(this.inMemoryPageDataDb, key);
        return this.pushAndReturn(true, true);
    }

    public async upsertBlockProperty(
        block: LogseqEntityIdentity,
        key: string,
        value: any,
        options: Partial<{reset: boolean}> = {}
    ): Promise<boolean> {
        const entity = await this.getImportedEntity(block);
        if (!entity) {
            throw new Error(`Failed to find block or page during upsertBlockProperty: ${block}`);
        }

        const properties = this.getMutableProperties(entity);
        const propertyDefinition = this.inMemoryMetadataDb.properties.get(key);
        if (options.reset === true || propertyDefinition?.schema.cardinality !== "many") {
            properties[key] = value;
        } else {
            const existingValue = properties[key];
            const values =
                existingValue === undefined
                    ? []
                    : Array.isArray(existingValue)
                      ? existingValue
                      : [existingValue];
            if (!values.some((storedValue) => _.isEqual(storedValue, value))) {
                values.push(value);
            }
            properties[key] = values;
        }

        return this.pushAndReturn(true, true);
    }

    public async removeBlockProperty(block: LogseqEntityIdentity, key: string): Promise<boolean> {
        this.assertMutablePropertyKey(key);
        const entity = await this.getImportedEntity(block);
        if (!entity) {
            throw new Error(`Failed to find block or page during removeBlockProperty: ${block}`);
        }

        if (entity.properties) {
            delete entity.properties[key];
        }
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

    private async findPageByName(pageName: string): Promise<InMemoryLogseqEntity | null> {
        const loadedPage = findEntity(this.inMemoryPageDataDb, pageName);
        if (loadedPage && isPageEntity(loadedPage)) return loadedPage;

        await this.importPageOfEntity(pageName);
        const importedPage = findEntity(this.inMemoryPageDataDb, pageName);
        return importedPage && isPageEntity(importedPage) ? importedPage : null;
    }

    private async importPageOfEntity(identity: LogseqEntityIdentity): Promise<void> {
        if (findPageContainingEntity(this.inMemoryPageDataDb, identity)) return;

        const loadedPage = await this.pageLoader.loadPageForIdentity(identity);
        if (!loadedPage || this.inMemoryPageDataDb.has(loadedPage.page.uuid)) return;

        const normalizedPage = await normalizeImportedPage(loadedPage.page, loadedPage.blocks);
        this.originalInMemoryPageDataDb.set(normalizedPage.uuid, _.cloneDeep(normalizedPage));
        this.inMemoryPageDataDb.set(normalizedPage.uuid, _.cloneDeep(normalizedPage));
    }

    private async getImportedEntity(
        identity: LogseqEntityIdentity
    ): Promise<InMemoryLogseqEntity | null> {
        await this.importPageOfEntity(identity);
        return findEntity(this.inMemoryPageDataDb, identity);
    }

    private getMutableProperties(entity: InMemoryLogseqEntity): Record<string, any> {
        const mutableEntity = entity as {properties?: Record<string, any>};
        mutableEntity.properties = mutableEntity.properties || {};
        return mutableEntity.properties;
    }

    private assertMutablePropertyKey(key: string): void {
        if (key === "uuid") {
            throw new Error("Cannot remove internal uuid property");
        }
    }
}
