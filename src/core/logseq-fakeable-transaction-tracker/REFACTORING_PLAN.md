# logseq-fakeable-transaction-tracker — Property & Tag Refactoring Plan

## Context

The `logseq-fakeable-transaction-tracker` module uses a Command + Dual-Executor pattern:
- **Commands** (`commands/`): `CreatePage`, `DeletePage`, `InsertBlock`, `MoveBlock`, `RenamePage`, `UpdateBlock`
- **Executors**: `InMemoryExecutor` (in-memory tree) and `LogseqExecutor` (real `logseq.Editor.*` API)
- **Data model**: `InMemoryDB = Map<string, InMemoryPageEntity>`. Pages have `children` (blocks). Blocks have `children` (nested blocks). Both have `properties: Record<string, any>`.
- **Printer**: `LogseqInMemoryDataPrinter` renders the in-memory DB as indented bullets with `key:: value` lines.

Currently there is **zero** support for property schemas, property CRUD on blocks, tags, tag inheritance, or tag-property associations. The `properties` field on entities is a flat `Record<string, any>` with no schema awareness.

## Reference: Logseq SDK APIs (from `logseq-source/libs/src/LSPlugin.ts`)

The target APIs to mirror:

```
// Property schema (DB only)
upsertProperty(key: string, schema?: Partial<PropertySchema>, opts?: { name?: string }): Promise<IEntityID>
removeProperty(key: string): Promise<void>
getProperty(key: string): Promise<BlockEntity | null>

// Block property values
upsertBlockProperty(block: BlockIdentity | EntityID, key: string, value: any, options?: { reset?: boolean }): Promise<void>
removeBlockProperty(block: BlockIdentity | EntityID, key: string): Promise<void>

// Tags / Classes
createTag(tagName: string, opts?: { uuid?: string, tagProperties?: Array<{ name: string, schema?: Partial<PropertySchema>, properties?: {} }> }): Promise<PageEntity | null>
addTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
removeTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
addTagExtends(tagId: BlockIdentity, parentTagIdOrName: BlockIdentity): Promise<void>
addBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>
removeBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>

// Block positioning (for insertBlock and moveBlock)
insertBlock(srcBlock, content, { before?, sibling?, start?, end? })
moveBlock(srcBlock, targetBlock, { before?, children? })
```

`PropertySchema` = `{ type: 'default'|'number'|'node'|'date'|'checkbox'|'url'|string, cardinality: 'many'|'one', hide: boolean, public: boolean }`

---

## Requirements

### (a) Move parent-into-own-child prevention

**Current state**: `InMemoryExecutor.moveBlock()` does NOT check whether the destination is a descendant of the source. It will happily move a block inside its own subtree, creating a cycle.

**Requirement**: Add a validation in `entityTree.ts` (e.g. `isDescendant(db, ancestor, candidateDescendant)`) and call it in `InMemoryExecutor.moveBlock()` BEFORE detaching. If `destBlockUUID` is a descendant of `srcBlockUUID`, throw: `"Cannot move a block inside its own subtree"`. Add a test for this case.

### (b) Cross-page block move

**Current state**: `InMemoryExecutor.moveBlock()` imports both source and destination pages, detaches, then reparents. This already works for cross-page moves — `reparentSubtree()` updates `page` references on the entire subtree. `LogseqExecutor.moveBlock()` calls `logseq.Editor.moveBlock()` which also supports cross-page.

**Requirement**: Verify with an explicit test that moving a block from Page A to Page B works correctly (parent, page references update, children follow). If the test passes, no code changes needed — just add the test.

### (c) Move a page under another page

**Current state**: Pages are top-level entries in `InMemoryDB` (the Map). `moveBlock` operates on `InMemoryBlockEntity` only. `detachBlock()` skips `isPageEntity()` matches. Pages cannot currently be moved.

**Requirement**: Add a `movePage(sourcePageIdentity, destPageIdentity)` method to both executors. In the in-memory executor:
1. Remove the source page from the DB Map.
2. Convert it to a block-like child under the destination page (set `parent` to destination page reference, keep `type: "page"` or convert to a child block node — decide based on Logseq's actual behavior).
3. Add it to the destination page's `children`.

Alternatively, if Logseq doesn't support pages-as-children-of-pages, then this requirement should be re-scoped to "move all blocks from one page to another page" instead. **Check Logseq source behavior first** before implementing.

### (d) Parent of a page must be a page

**Current state**: No validation exists for page parentage.

**Requirement**: If (c) is implemented as "page under page", add validation in the move logic: if the entity being moved is a page (`type === "page"`), the destination must also be a page. Throw: `"A page can only be moved under another page, not under a block"`. If (c) is re-scoped, this requirement adapts accordingly.

### (e) Refactoring entityTree / related files

**Current state**: `entityTree.ts` has 132 lines with functions for `findEntity`, `findPageContainingEntity`, `insertChild`, `detachBlock`, `reparentSubtree`, `matchesIdentity`, `isPageEntity`. The `findBlockInChildren` helper skips page entities. `detachBlockFromParent` also skips pages.

**Requirement**: Refactor as needed to support:
- Descendant checking (for requirement a)
- Page-aware tree operations (for requirements c/d)
- Tag/property entity resolution (for requirement f)
- Consider splitting into `entityTree.ts` (block operations) + `pageTree.ts` (page-level operations) if it grows beyond ~200 lines.

### (f) Property and Tag support

This is the largest change. The following new abstractions are needed:

#### New types (in `types.ts`)

- `InMemoryPropertyEntity`: `{ uuid, name, type: "property", schema: PropertySchema, properties: Record<string, any> }`
- `InMemoryTagEntity`: `{ uuid, name, type: "tag", tagProperties: string[] /* property keys */, extends: string[] /* parent tag names/uuids */, children: InMemoryLogseqEntity[] }`
- Update `InMemoryLogseqEntity` union to include `InMemoryPropertyEntity | InMemoryTagEntity`
- Add a `propertySchemas` Map to `InMemoryDB` (or a separate `InMemoryPropertyDB = Map<string, InMemoryPropertyEntity>`) for property definitions
- Add a `tags` Map to `InMemoryDB` (or separate `InMemoryTagDB = Map<string, InMemoryTagEntity>`) for tag definitions

#### New abstract methods on `LogseqTransactionExecutor`

```
upsertProperty(key: string, schema?: Partial<PropertySchema>, opts?: { name?: string }): Promise<boolean>
removeProperty(key: string): Promise<boolean>
upsertBlockProperty(block: LogseqEntityIdentity, key: string, value: any, options?: { reset?: boolean }): Promise<boolean>
removeBlockProperty(block: LogseqEntityIdentity, key: string): Promise<boolean>
createTag(tagName: string, opts?: { uuid?: string, tagProperties?: Array<{ name: string, schema?: Partial<PropertySchema> }> }): Promise<boolean>
addTagProperty(tagId: LogseqEntityIdentity, propertyIdOrName: LogseqEntityIdentity): Promise<boolean>
removeTagProperty(tagId: LogseqEntityIdentity, propertyIdOrName: LogseqEntityIdentity): Promise<boolean>
addTagExtends(tagId: LogseqEntityIdentity, parentTagIdOrName: LogseqEntityIdentity): Promise<boolean>
addBlockTag(blockId: LogseqEntityIdentity, tagId: LogseqEntityIdentity): Promise<boolean>
removeBlockTag(blockId: LogseqEntityIdentity, tagId: LogseqEntityIdentity): Promise<boolean>
```

#### New command classes (one per operation)

`UpsertPropertyCommand`, `RemovePropertyCommand`, `UpsertBlockPropertyCommand`, `RemoveBlockPropertyCommand`, `CreateTagCommand`, `AddTagPropertyCommand`, `RemoveTagPropertyCommand`, `AddTagExtendsCommand`, `AddBlockTagCommand`, `RemoveBlockTagCommand`.

Update `SerializedLogseqFakeableCommand` union with each new command type.

#### `InMemoryExecutor` implementation notes

- `upsertProperty`: Creates/updates an `InMemoryPropertyEntity` in a `propertySchemas` Map on the DB.
- `upsertBlockProperty`: Finds the block, sets `block.properties[key] = value`. If `reset` is true, replaces instead of merging.
- `removeBlockProperty`: Finds the block, deletes `block.properties[key]`.
- `createTag`: Creates a page-like entity with `type: "tag"`, stores in a `tags` Map. If `tagProperties` provided, also creates the property schemas and links them.
- `addTagProperty`: Finds the tag, adds the property key to `tag.tagProperties`. Creates the property schema if it doesn't exist.
- `removeTagProperty`: Removes the property key from `tag.tagProperties`.
- `addTagExtends`: Adds parent tag reference to `tag.extends`.
- `addBlockTag`: Sets `block.properties["tags"]` to include the tag (or use a dedicated `tags` field on the block entity — check Logseq's convention).
- `removeBlockTag`: Removes the tag from `block.properties["tags"]`.

#### `LogseqExecutor` implementation

Each method maps directly to `logseq.Editor.*` calls.

#### Special tags

`#Page` is a built-in tag. `createTag("Page")`, `addTagProperty("Page", ...)`, `removeBlockTag(block, "Page")` etc. should all throw: `"Cannot modify built-in tag: Page"`.

#### Tag inheritance

When a block has tag T, and T extends parent tag P, the block should inherit P's `tagProperties`. The in-memory executor should resolve inherited properties when reading block properties.

#### Normalization requirement

When the `LogseqExecutor` calls real Logseq APIs, some may return numeric entity IDs instead of UUIDs/names. The `InMemoryExecutor` must normalize these: tag IDs -> tag names, property IDs -> property names. Use the existing `normalizeAndResolveUUIDObject` pattern from `normalizeLogseqEntity.ts`.

### (g) Positioning options for moveBlock and insertBlock

**Current state**:
- `insertBlock(parentUUID, content)` — always appends as last child. No `before`, `sibling`, `start`, `end` options.
- `moveBlock(srcUUID, destUUID)` — always moves as last child of destination. No `before` option.

**Requirement**:
- `insertBlock` signature becomes: `insertBlock(parentUUID: LogseqEntityIdentity, content: string, opts?: { before?: boolean, sibling?: boolean, start?: boolean, end?: boolean })`. In `InMemoryExecutor`: if `sibling`, insert as sibling of parent (after/before parent in its parent's children list). If `start`, insert at index 0 of children. If `before`, insert before the target in its parent's children. Default (no opts) = append as last child (current behavior).
- `moveBlock` signature becomes: `moveBlock(srcUUID: LogseqEntityIdentity, destUUID: LogseqEntityIdentity, opts?: { before?: boolean })`. In `InMemoryExecutor`: if `before`, insert before destination in its parent's children instead of appending.
- Update both `InsertBlockCommand` and `MoveBlockCommand` to accept and serialize these options.
- Update `LogseqExecutor` to pass the options through to `logseq.Editor.insertBlock()` and `logseq.Editor.moveBlock()`.
- Update the Zod schemas in `LogseqInsertBlockTool` and `LogseqMoveBlockTool` to expose these new parameters.

---

## Printer / Formatter Changes (`LogseqInMemoryDataPrinter`)

**Current state**: Prints `key:: value` lines for properties, filtering `uuid`. No tag or property schema display.

**Requirement**:
- Tags and their schemas should be displayed as page-like entries (separate top-level sections in the printer output).
- Block tags should appear as property lines (e.g., `tags:: [[TagName]]`).
- Property schemas should be displayed as pages with their type/cardinality info (e.g., a property `rating` with schema `{type: 'number', cardinality: 'one'}` prints as a page showing the schema definition).
- Block property values remain stored in `block.properties` and printed as `key:: value` lines.

---

## Import / Normalization Changes

**Current state**: `normalizeImportedPage()` in `normalizeLogseqEntity.ts` copies `page.properties` directly. No tag or property schema handling.

**Requirement**:
- When importing a page, also import its tag definitions and property schemas.
- Tag inheritance must be resolved: if a block has tag T and T extends P, the block's effective properties should include P's `tagProperties`.
- Normalize tag IDs to tag names and property IDs to property names in the in-memory representation.

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `types.ts` | Add `InMemoryPropertyEntity`, `InMemoryTagEntity`, update `InMemoryLogseqEntity` union, add new serialized command types, add `PropertySchema` type |
| `entityTree.ts` | Add `isDescendant()`, refactor for page-aware operations |
| `LogseqTransactionExecutor.ts` | Add 10 new abstract methods |
| `InMemoryExecutor.ts` | Implement 10 new methods + update `moveBlock`/`insertBlock` signatures |
| `LogseqExecutor.ts` | Implement 10 new methods + update `moveBlock`/`insertBlock` signatures |
| `entityFactory.ts` | Add `createInMemoryProperty()`, `createInMemoryTag()` |
| `LogseqInMemoryDataPrinter.ts` | Display tags, property schemas, block tags |
| `normalizeLogseqEntity.ts` | Import tags, schemas, resolve inheritance, normalize IDs->names |
| `InMemoryPageLoader.ts` | Load tag/property pages if needed |
| `InsertBlockCommand.ts` | Add positioning options |
| `MoveBlockCommand.ts` | Add `before` option |
| 10 new command files | One per new operation |
| `commands/index.ts` | Export new commands |
| `index.ts` | Export new types |
| `LogseqInsertBlockTool.tsx` | Add `before`, `sibling`, `start`, `end` to Zod schema |
| `LogseqMoveBlockTool.tsx` | Add `before` to Zod schema |
| 10 new tool files | One per new command (or a generic property/tag tool) |
| `InMemoryExecutor.test.ts` | Add tests for (a) cycle prevention, (b) cross-page move, (c/d) page moves, (f) property/tag CRUD, (g) positioning |
| New: `entityTree.test.ts` | Unit tests for `isDescendant`, tree operations |
| New: property/tag tool test files | Per tool |

---

## Implementation Order (suggested)

1. **Phase 1 — entityTree refactor + move validation** (requirements a, b, d, e)
2. **Phase 2 — insertBlock/moveBlock positioning** (requirement g)
3. **Phase 3 — Property schema + block property CRUD** (requirement f, properties part)
4. **Phase 4 — Tag CRUD + inheritance** (requirement f, tags part)
5. **Phase 5 — Printer/formatter updates** (display tags, schemas)
6. **Phase 6 — Import normalization** (tag inheritance, ID->name normalization)
7. **Phase 7 — Tool layer** (new AI tools for property/tag operations)

Each phase should include corresponding tests.
