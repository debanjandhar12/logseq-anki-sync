import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import type {DeterminesticUUIDGenerator} from "../DeterminesticUUIDGenerator";
import type {
    CreateTagOptions,
    InMemoryBlockEntity,
    InMemoryDB,
    InMemoryLogseqEntity,
    InMemoryPageEntity,
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
    type InMemorySchemaPageLoader,
    LogseqInMemorySchemaPageLoader
} from "./in-memory-executor-utils/InMemorySchemaPageLoader";
import {removePropertyFromEntities} from "./in-memory-executor-utils/propertyMutation";
import {
    createPropertyPage,
    createTagPage,
    getPropertySchema,
    getTagExtends,
    getTagPropertyKeys,
    isPropertyPage,
    isTagPage,
    setPropertySchema,
    setTagExtends,
    setTagPropertyKeys
} from "./in-memory-executor-utils/schemaPage";
import {normalizeImportedPage} from "./in-memory-executor-utils/normalizeLogseqEntity";
import {
    DEFAULT_INSERT_BLOCK_OPTIONS,
    DEFAULT_MOVE_BLOCK_OPTIONS,
    type InsertBlockOptions,
    LogseqTransactionExecutor,
    type MoveBlockOptions
} from "./LogseqTransactionExecutor";

export type {InMemoryPageLoader} from "./in-memory-executor-utils/InMemoryPageLoader";
export type {InMemorySchemaPageLoader} from "./in-memory-executor-utils/InMemorySchemaPageLoader";

export class InMemoryExecutor extends LogseqTransactionExecutor {
    private readonly originalInMemoryPageDataDb: InMemoryDB = new Map();

    private readonly inMemoryPageDataDb: InMemoryDB = new Map();

    public constructor(
        uuidGenerator: DeterminesticUUIDGenerator,
        private readonly pageLoader: InMemoryPageLoader = new LogseqInMemoryPageLoader(),
        private readonly schemaPageLoader: InMemorySchemaPageLoader = new LogseqInMemorySchemaPageLoader()
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
        const existingPage = await this.getOrLoadPropertyPage(key);
        if (existingPage) {
            setPropertySchema(existingPage, {...getPropertySchema(existingPage), ...schema});
            if (options.name !== undefined) {
                existingPage.title = options.name;
                existingPage.fullTitle = options.name;
                existingPage.content = options.name;
            }
        } else {
            const propertyPage = createPropertyPage(
                this.uuidGenerator.getUUID(),
                key,
                schema,
                options.name,
                {},
                Date.now()
            );
            this.inMemoryPageDataDb.set(propertyPage.uuid, propertyPage);
        }

        return this.pushAndReturn(true, true);
    }

    public async removeProperty(key: string): Promise<boolean> {
        this.assertMutablePropertyKey(key);
        const propertyPage = await this.getOrLoadPropertyPage(key);
        if (propertyPage) {
            this.inMemoryPageDataDb.delete(propertyPage.uuid);
        }
        for (const page of this.inMemoryPageDataDb.values()) {
            if (!isTagPage(page)) continue;
            setTagPropertyKeys(
                page,
                getTagPropertyKeys(page).filter((propertyKey) => propertyKey !== key)
            );
        }
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
        const propertyPage = await this.getOrLoadPropertyPage(key);
        if (options.reset === true || getPropertySchema(propertyPage).cardinality !== "many") {
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

    public async createTag(tagName: string, options: CreateTagOptions = {}): Promise<boolean> {
        this.assertMutableTag(tagName);
        let tagPage = await this.getOrLoadTagPage(tagName);
        if (!tagPage) {
            tagPage = createTagPage(
                options.uuid || this.uuidGenerator.getUUID(),
                tagName,
                {},
                Date.now()
            );
            this.inMemoryPageDataDb.set(tagPage.uuid, tagPage);
        }

        for (const tagProperty of options.tagProperties || []) {
            await this.upsertProperty(tagProperty.name, tagProperty.schema);
            const propertyPage = await this.getOrLoadPropertyPage(tagProperty.name);
            if (propertyPage && tagProperty.properties) {
                propertyPage.properties = {
                    ...propertyPage.properties,
                    ...tagProperty.properties
                };
            }
            const tagPropertyKeys = getTagPropertyKeys(tagPage);
            if (!tagPropertyKeys.includes(tagProperty.name)) {
                setTagPropertyKeys(tagPage, [...tagPropertyKeys, tagProperty.name]);
            }
        }

        return this.pushAndReturn(true, true);
    }

    public async addTagProperty(
        tagId: LogseqEntityIdentity,
        propertyIdOrName: LogseqEntityIdentity
    ): Promise<boolean> {
        const tagPage = await this.requireMutableTagPage(tagId, "addTagProperty");
        const propertyKey = await this.resolvePropertyKey(propertyIdOrName, true);
        const tagPropertyKeys = getTagPropertyKeys(tagPage);
        if (!tagPropertyKeys.includes(propertyKey)) {
            setTagPropertyKeys(tagPage, [...tagPropertyKeys, propertyKey]);
        }
        return this.pushAndReturn(true, true);
    }

    public async removeTagProperty(
        tagId: LogseqEntityIdentity,
        propertyIdOrName: LogseqEntityIdentity
    ): Promise<boolean> {
        const tagPage = await this.requireMutableTagPage(tagId, "removeTagProperty");
        const propertyKey = await this.resolvePropertyKey(propertyIdOrName, false);
        setTagPropertyKeys(
            tagPage,
            getTagPropertyKeys(tagPage).filter((key) => key !== propertyKey)
        );
        return this.pushAndReturn(true, true);
    }

    public async addTagExtends(
        tagId: LogseqEntityIdentity,
        parentTagIdOrName: LogseqEntityIdentity
    ): Promise<boolean> {
        const tagPage = await this.requireMutableTagPage(tagId, "addTagExtends");
        const parentPage = await this.requireTagPage(parentTagIdOrName, "addTagExtends");
        if (tagPage.name === parentPage.name) {
            throw new Error(`Tag cannot extend itself: ${tagPage.name}`);
        }
        if (this.tagExtends(parentPage.name, tagPage.name)) {
            throw new Error(
                `Tag inheritance cycle detected: ${tagPage.name} -> ${parentPage.name}`
            );
        }
        const extendsTags = getTagExtends(tagPage);
        if (!extendsTags.includes(parentPage.name)) {
            setTagExtends(tagPage, [...extendsTags, parentPage.name]);
        }
        return this.pushAndReturn(true, true);
    }

    public async removeTagExtends(
        tagId: LogseqEntityIdentity,
        parentTagIdOrName: LogseqEntityIdentity
    ): Promise<boolean> {
        const tagPage = await this.requireMutableTagPage(tagId, "removeTagExtends");
        const parentName = await this.resolveTagName(parentTagIdOrName);
        setTagExtends(
            tagPage,
            getTagExtends(tagPage).filter((name) => name !== parentName)
        );
        return this.pushAndReturn(true, true);
    }

    public async addBlockTag(
        blockId: LogseqEntityIdentity,
        tagId: LogseqEntityIdentity
    ): Promise<boolean> {
        const entity = await this.getImportedEntity(blockId);
        if (!entity) {
            throw new Error(`Failed to find block or page during addBlockTag: ${blockId}`);
        }
        const tagName = await this.resolveTagName(tagId);
        this.assertMutableTag(tagName);
        const tags = await this.normalizeTagValues(this.getMutableProperties(entity).tags);
        if (!tags.includes(tagName)) tags.push(tagName);
        this.getMutableProperties(entity).tags = tags;
        return this.pushAndReturn(true, true);
    }

    public async removeBlockTag(
        blockId: LogseqEntityIdentity,
        tagId: LogseqEntityIdentity
    ): Promise<boolean> {
        const entity = await this.getImportedEntity(blockId);
        if (!entity) {
            throw new Error(`Failed to find block or page during removeBlockTag: ${blockId}`);
        }
        const tagName = await this.resolveTagName(tagId);
        this.assertMutableTag(tagName);
        const tags = await this.normalizeTagValues(entity.properties?.tags);
        this.getMutableProperties(entity).tags = tags.filter((name) => name !== tagName);
        return this.pushAndReturn(true, true);
    }

    public getTagPropertyKeys(tagName: string): string[] {
        const tagPage = this.findTagPage(tagName);
        if (!tagPage) throw new Error(`Failed to find tag: ${tagName}`);
        return getTagPropertyKeys(tagPage);
    }

    public getInheritedTagPropertyKeys(tagName: string): string[] {
        const keys: string[] = [];
        const visited = new Set<string>();
        const visit = (name: string): void => {
            if (visited.has(name)) return;
            visited.add(name);
            const tagPage = this.findTagPage(name);
            if (!tagPage) return;
            for (const parentName of getTagExtends(tagPage)) {
                visit(parentName);
                for (const key of this.getTagPropertyKeys(parentName)) {
                    if (!keys.includes(key)) keys.push(key);
                }
            }
        };
        visit(tagName);
        return keys;
    }

    public async getEffectiveBlockPropertySchema(
        blockIdentity: LogseqEntityIdentity
    ): Promise<Map<string, InMemoryPageEntity>> {
        const entity = await this.getImportedEntity(blockIdentity);
        if (!entity) {
            throw new Error(
                `Failed to find block or page during getEffectiveBlockPropertySchema: ${blockIdentity}`
            );
        }
        const schema = new Map<string, InMemoryPageEntity>();
        for (const tagName of await this.normalizeTagValues(entity.properties?.tags)) {
            const tagPage = await this.getOrLoadTagPage(tagName);
            if (!tagPage) continue;
            const keys = [
                ...this.getInheritedTagPropertyKeys(tagPage.name),
                ...this.getTagPropertyKeys(tagPage.name)
            ];
            for (const key of keys) {
                const propertyPage = await this.getOrLoadPropertyPage(key);
                if (propertyPage) schema.set(key, propertyPage);
            }
        }
        return schema;
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
        await this.normalizeEntityTreeTags(normalizedPage);
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

    private async getOrLoadPropertyPage(
        identity: LogseqEntityIdentity
    ): Promise<InMemoryPageEntity | null> {
        const existingPage = this.findPropertyPage(identity);
        if (existingPage) return existingPage;

        const loadedPage = await this.schemaPageLoader.loadPropertyPage(identity);
        if (!loadedPage) return null;
        return this.registerImportedSchemaPage(loadedPage);
    }

    private async getOrLoadTagPage(
        identity: LogseqEntityIdentity
    ): Promise<InMemoryPageEntity | null> {
        const existingPage = this.findTagPage(identity);
        if (existingPage) return existingPage;

        const loadedPage = await this.schemaPageLoader.loadTagPage(identity);
        if (!loadedPage) return null;
        const tagPage = this.registerImportedSchemaPage(loadedPage);
        for (const propertyKey of getTagPropertyKeys(tagPage)) {
            await this.getOrLoadPropertyPage(propertyKey);
        }
        for (const parentName of getTagExtends(tagPage)) {
            await this.getOrLoadTagPage(parentName);
        }
        return tagPage;
    }

    private registerImportedSchemaPage(page: InMemoryPageEntity): InMemoryPageEntity {
        const originalPage = _.cloneDeep(page);
        const currentPage = _.cloneDeep(page);
        this.originalInMemoryPageDataDb.set(page.uuid, originalPage);
        this.inMemoryPageDataDb.set(page.uuid, currentPage);
        return currentPage;
    }

    private findPropertyPage(identity: LogseqEntityIdentity): InMemoryPageEntity | null {
        return this.findSchemaPage(identity, isPropertyPage);
    }

    private findTagPage(identity: LogseqEntityIdentity): InMemoryPageEntity | null {
        return this.findSchemaPage(identity, isTagPage);
    }

    private findSchemaPage(
        identity: LogseqEntityIdentity,
        predicate: (page: InMemoryPageEntity) => boolean
    ): InMemoryPageEntity | null {
        for (const page of this.inMemoryPageDataDb.values()) {
            if (predicate(page) && this.matchesPageIdentity(page, identity)) return page;
        }
        return null;
    }

    private matchesPageIdentity(
        page: InMemoryPageEntity,
        identity: LogseqEntityIdentity
    ): boolean {
        if (typeof identity === "number") return page.id === identity;
        if (typeof identity === "string") {
            return page.uuid === identity || page.name === identity || page.ident === identity;
        }
        return page.uuid === identity.uuid;
    }

    private async resolvePropertyKey(
        identity: LogseqEntityIdentity,
        createPlainString: boolean
    ): Promise<string> {
        const propertyPage = await this.getOrLoadPropertyPage(identity);
        if (propertyPage) return propertyPage.name;
        if (createPlainString && typeof identity === "string") {
            await this.upsertProperty(identity);
            return identity;
        }
        throw new Error(`Failed to resolve property identity: ${this.stringifyIdentity(identity)}`);
    }

    private async resolveTagName(identity: LogseqEntityIdentity): Promise<string> {
        const tagPage = await this.getOrLoadTagPage(identity);
        if (tagPage) return tagPage.name;
        throw new Error(`Failed to resolve tag identity: ${this.stringifyIdentity(identity)}`);
    }

    private async requireMutableTagPage(
        identity: LogseqEntityIdentity,
        operation: string
    ): Promise<InMemoryPageEntity> {
        const tagName = await this.resolveTagName(identity);
        this.assertMutableTag(tagName);
        return this.requireTagPage(tagName, operation);
    }

    private async requireTagPage(
        identity: LogseqEntityIdentity,
        operation: string
    ): Promise<InMemoryPageEntity> {
        const tagName = await this.resolveTagName(identity);
        const tagPage = this.findTagPage(tagName);
        if (!tagPage) throw new Error(`Failed to find tag during ${operation}: ${tagName}`);
        return tagPage;
    }

    private assertMutableTag(tagName: string): void {
        const normalizedName = tagName.startsWith("#") ? tagName.slice(1) : tagName;
        if (normalizedName.toLowerCase() === "page") {
            throw new Error("Built-in Page tag cannot be modified");
        }
    }

    private tagExtends(tagName: string, expectedAncestorName: string): boolean {
        const visited = new Set<string>();
        const visit = (name: string): boolean => {
            if (name === expectedAncestorName) return true;
            if (visited.has(name)) return false;
            visited.add(name);
            const tagPage = this.findTagPage(name);
            return getTagExtends(tagPage || undefined).some((parentName) => visit(parentName));
        };
        return visit(tagName);
    }

    private async normalizeEntityTreeTags(entity: InMemoryLogseqEntity): Promise<void> {
        if (entity.properties && "tags" in entity.properties) {
            entity.properties.tags = await this.normalizeTagValues(entity.properties.tags);
        }
        for (const child of entity.children || []) {
            await this.normalizeEntityTreeTags(child);
        }
    }

    private async normalizeTagValues(value: unknown): Promise<string[]> {
        const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
        const names: string[] = [];
        for (const tagIdentity of values) {
            if (
                typeof tagIdentity !== "string" &&
                typeof tagIdentity !== "number" &&
                !(
                    typeof tagIdentity === "object" &&
                    tagIdentity !== null &&
                    "uuid" in tagIdentity &&
                    typeof tagIdentity.uuid === "string"
                )
            ) {
                continue;
            }
            const identity = tagIdentity as LogseqEntityIdentity;
            const loadedPage = await this.getOrLoadTagPage(identity);
            const name = loadedPage?.name ?? (typeof identity === "string" ? identity : undefined);
            if (!name) {
                throw new Error(
                    `Failed to resolve numeric or opaque tag identity: ${this.stringifyIdentity(identity)}`
                );
            }
            if (!names.includes(name)) names.push(name);
        }
        return names;
    }

    private stringifyIdentity(identity: LogseqEntityIdentity): string {
        return typeof identity === "object" ? JSON.stringify(identity) : String(identity);
    }
}
