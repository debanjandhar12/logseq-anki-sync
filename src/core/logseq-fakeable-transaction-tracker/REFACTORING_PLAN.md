# logseq-fakeable-transaction-tracker Refactoring Plan

## Goal

Improve `src/core/logseq-fakeable-transaction-tracker` so AI tools can stage Logseq changes in memory, print a reviewable preview, and then apply the approved transaction through `LogseqExecutor` with behavior close to the real Logseq SDK.

The immediate scope is:

- Fix unsafe block/page movement edge cases.
- Add Logseq SDK positioning options to `insertBlock` and `moveBlock`.
- Add DB property schema support.
- Add block property value support.
- Add tag/class support, including tag properties and inheritance.
- Keep the in-memory preview deterministic, readable, and close to real Logseq behavior.

## Current Architecture

The module already uses a good base architecture:

- `LogseqFakeableTransactionTracker` stores a queue of `LogseqFakeableCommand` instances.
- Each command can execute against either `InMemoryExecutor` or `LogseqExecutor`.
- `InMemoryExecutor` mutates an in-memory page/block tree for preview.
- `LogseqExecutor` calls real `logseq.Editor.*` APIs after user approval.
- `LogseqFakeableTransactionCommandSerializer` serializes/deserializes command history.
- `LogseqInMemoryDataPrinter` prints the in-memory DB for review.

Existing partial property support:

- `InMemoryBlockEntity` and `InMemoryPageEntity` already have `properties`.
- Imported blocks/pages already carry properties through `LogseqPropertiesHelper` and `normalizeLogseqEntity.ts`.
- `createPage(pageName, properties)` already supports initial page properties.
- `LogseqInMemoryDataPrinter` already prints non-`uuid` properties as `key:: value`.

Missing support:

- No property schema entities.
- No command/executor methods for `upsertProperty`, `removeProperty`, `upsertBlockProperty`, or `removeBlockProperty`.
- No tag/class model.
- No command/executor methods for `createTag`, `addTagProperty`, `removeTagProperty`, `addTagExtends`, `removeTagExtends`, `addBlockTag`, or `removeBlockTag`.
- No positioning options for `insertBlock` or `moveBlock`.
- No prevention for moving a block into its own subtree.

## Logseq SDK Reference

Use `logseq-source/libs/src/LSPlugin.ts` and `logseq-source/libs/cljs-sdk/src/com/logseq/editor.cljs` as source-of-truth references.

Relevant SDK signatures:

```ts
export type PropertySchema = {
  type: 'default' | 'number' | 'node' | 'date' | 'checkbox' | 'url' | string
  cardinality: 'many' | 'one'
  hide: boolean
  public: boolean
}

insertBlock(
  srcBlock: BlockIdentity | EntityID,
  content: string,
  opts?: Partial<{
    before: boolean
    sibling: boolean
    start: boolean
    end: boolean
    customUUID: string
    properties: {}
  }>
): Promise<BlockEntity | null>

moveBlock(
  srcBlock: BlockIdentity,
  targetBlock: BlockIdentity,
  opts?: Partial<{ before: boolean; children: boolean }>
): Promise<void>

createTag(
  tagName: string,
  opts?: Partial<{
    uuid: string
    tagProperties: Array<{ name: string; schema?: Partial<PropertySchema>; properties?: {} }>
  }>
): Promise<PageEntity | null>

addTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
removeTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
addTagExtends(tagId: BlockIdentity, parentTagIdOrName: BlockIdentity): Promise<void>
removeTagExtends(tagId: BlockIdentity, parentTagIdOrName: BlockIdentity): Promise<void>
addBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>
removeBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>

upsertProperty(
  key: string,
  schema?: Partial<PropertySchema>,
  opts?: { name?: string }
): Promise<IEntityID>
removeProperty(key: string): Promise<void>
upsertBlockProperty(
  block: BlockIdentity | EntityID,
  key: string,
  value: any,
  options?: Partial<{ reset: boolean }>
): Promise<void>
removeBlockProperty(block: BlockIdentity | EntityID, key: string): Promise<void>
```

## Design Principles

- Preserve the current Command + Dual-Executor architecture.
- Prefer minimal data model extensions over replacing `InMemoryDB` globally.
- Keep command serialization backward compatible for existing saved artifacts.
- In-memory behavior should fail fast when it detects an operation Logseq would reject.
- Do not silently normalize invalid identities. Normalize IDs only when they can be resolved to known tag/property names.
- Keep the review printer human-readable, not a full Logseq file formatter.

## Proposed Data Model

Keep the existing page/block tree as-is:

```ts
export type InMemoryDB = Map<string, InMemoryPageEntity>
```

Add separate stores to `InMemoryExecutor` instead of changing every caller of `InMemoryDB`:

```ts
export type InMemoryPropertyDefinition = {
  uuid: string
  key: string
  name?: string
  type: 'property'
  schema: Partial<PropertySchema>
  properties: Record<string, any>
}

export type InMemoryTagDefinition = {
  uuid: string
  name: string
  type: 'tag'
  tagProperties: string[]
  extends: string[]
  properties: Record<string, any>
}

export type InMemoryMetadataDB = {
  properties: Map<string, InMemoryPropertyDefinition>
  tags: Map<string, InMemoryTagDefinition>
}
```

Rationale:

- Existing code and tests expect `getInMemoryPageDataDb()` to return `Map<string, InMemoryPageEntity>`.
- Tags and properties are metadata for preview and validation, not normal block tree children.
- The printer can accept the executor or an optional metadata DB when it needs to print schemas/tags.

Add accessors to `InMemoryExecutor`:

```ts
getInMemoryMetadataDb(): InMemoryMetadataDB
getOriginalInMemoryMetadataDb(): InMemoryMetadataDB
```

## Movement Requirements

### 1. Prevent moving a block into its own subtree

Current behavior is unsafe. `moveBlock(root, grandchild)` can create a cycle because the destination is looked up after detaching.

Implement in `entityTree.ts`:

```ts
isDescendantOf(entity: InMemoryLogseqEntity, possibleAncestor: InMemoryLogseqEntity): boolean
findParentOfEntity(db: InMemoryDB, identity: LogseqEntityIdentity): InMemoryLogseqEntity | null
```

In `InMemoryExecutor.moveBlock()`:

- Import source and destination pages.
- Find source and destination before detaching.
- If destination is inside source's subtree, throw `Cannot move a block inside its own subtree`.
- Then detach and reinsert.

Add test coverage:

- `moveBlock(root, child)` rejects.
- The original tree remains unchanged after rejection.

### 2. Explicitly test cross-page block moves

The current implementation appears intended to support this, but it needs a dedicated regression test.

Test expectations:

- Moving a root block from Page A under a block on Page B succeeds.
- Source page no longer contains the moved block.
- Moved block's `parent` points to the destination block.
- Moved block and all descendants have `page` pointing to Page B.

### 3. Page movement: validate Logseq behavior before implementing

The current plan must not assume that Logseq pages can be physically nested as children in the block tree. In Logseq, pages/classes/tags are page-like entities, and page hierarchy may be name-based or metadata-based depending on graph mode.

Before implementing `movePage`, inspect Logseq source and/or SDK behavior for:

- Whether there is an SDK API that moves a page under another page.
- Whether DB graph pages/classes can have a parent page through properties.
- Whether `moveBlock(pageUuid, targetPageUuid)` is legal for page entities.

If Logseq supports page parentage:

- Add explicit `movePage(sourcePageIdentity, destPageIdentity)`.
- Destination must resolve to a page/tag/class, never a normal block.
- Moving a page under a block must throw `A page can only be moved under another page`.

If Logseq does not support page parentage through these APIs:

- Do not add fake in-memory behavior that cannot be committed by `LogseqExecutor`.
- Replace the requirement with the supported operation, for example `movePageBlocks(sourcePage, destinationPage)` or `renamePage` for namespace-style hierarchy.

## Positioning Support

### Insert block options

Update the executor interface:

```ts
export type InsertBlockOptions = Partial<{
  before: boolean
  sibling: boolean
  start: boolean
  end: boolean
}>

insertBlock(
  parentBlockUUID: LogseqEntityIdentity,
  content: string,
  options?: InsertBlockOptions
): Promise<boolean>
```

In `LogseqExecutor`, pass through these options plus `customUUID`:

```ts
logseq.Editor.insertBlock(parentBlockUUID, content, {
  ...options,
  customUUID: this.uuidGenerator.getUUID()
})
```

In `InMemoryExecutor`, implement the same positioning semantics as Logseq as closely as possible:

- Default: insert as last child of `srcBlock`.
- `start: true`: insert as first child of `srcBlock`.
- `end: true`: insert as last child of `srcBlock`.
- `sibling: true`: insert as sibling of `srcBlock`.
- `sibling: true, before: true`: insert before `srcBlock`.
- `sibling: true, before: false`: insert after `srcBlock`.
- `before: true` without `sibling`: verify against Logseq behavior before finalizing; if Logseq treats this as insert before `srcBlock`, mirror that. Otherwise reject ambiguous option combinations.

Add helpers:

```ts
insertChildAt(parent, child, index)
insertSibling(db, targetIdentity, child, before)
findParentAndIndex(db, identity)
```

### Move block options

Update the executor interface:

```ts
export type MoveBlockOptions = Partial<{
  before: boolean
  children: boolean
}>

moveBlock(
  srcBlockUUID: LogseqEntityIdentity,
  destBlockUUID: LogseqEntityIdentity,
  options?: MoveBlockOptions
): Promise<boolean>
```

In `LogseqExecutor`, pass through `{ children: true, ...options }` so children continue to move by default.

In `InMemoryExecutor`:

- Default: move source as last child of destination.
- `before: true`: move source as sibling immediately before destination.
- Keep `children: true` behavior as the only supported in-memory behavior for now. If `children: false` is passed, either implement child detachment semantics after checking Logseq behavior or reject with a clear error.

Update:

- `InsertBlockCommand`
- `MoveBlockCommand`
- `SerializedLogseqFakeableCommand`
- `LogseqFakeableTransactionCommandSerializer.deserialize()`
- `LogseqInsertBlockTool.tsx`
- `LogseqMoveBlockTool.tsx`

## Property Schema Support

### New executor methods

Add to `LogseqTransactionExecutor`:

```ts
upsertProperty(
  key: string,
  schema?: Partial<PropertySchema>,
  options?: { name?: string }
): Promise<boolean>

removeProperty(key: string): Promise<boolean>
```

### In-memory behavior

- `upsertProperty` creates or updates `metadata.properties` keyed by stable property key.
- Generate deterministic UUIDs for newly created property definitions.
- Preserve existing property definition UUID on repeated upsert.
- Store display name from `options.name` separately from the stable key.
- `removeProperty` removes the schema definition but does not automatically remove existing block property values unless real Logseq does so. Verify SDK behavior before cascading.

### Logseq behavior

- `LogseqExecutor.upsertProperty` calls `logseq.Editor.upsertProperty(key, schema, options)`.
- `LogseqExecutor.removeProperty` calls `logseq.Editor.removeProperty(key)`.

### Commands

Add:

- `UpsertPropertyCommand`
- `RemovePropertyCommand`

Update serializer and command exports.

## Block Property Value Support

### New executor methods

```ts
upsertBlockProperty(
  block: LogseqEntityIdentity,
  key: string,
  value: any,
  options?: Partial<{ reset: boolean }>
): Promise<boolean>

removeBlockProperty(block: LogseqEntityIdentity, key: string): Promise<boolean>
```

### In-memory behavior

- Resolve the target with `getImportedEntity()`.
- Reject if the target is missing.
- Allow page and block targets only if real Logseq's `upsertBlockProperty` accepts pages by UUID. If not, add separate page property handling later.
- Initialize `entity.properties` when missing.
- For one-value properties or `reset: true`, set `properties[key] = value`.
- For many-value properties and `reset !== true`, mirror Logseq behavior if known. If unknown, use conservative replacement and document it in tests.
- `removeBlockProperty` deletes `properties[key]`, but must not remove internal `uuid`.

### Commands

Add:

- `UpsertBlockPropertyCommand`
- `RemoveBlockPropertyCommand`

## Tag Support

### New executor methods

Add all SDK tag methods, including the one omitted in the first plan:

```ts
createTag(
  tagName: string,
  options?: Partial<{
    uuid: string
    tagProperties: Array<{ name: string; schema?: Partial<PropertySchema>; properties?: {} }>
  }>
): Promise<boolean>

addTagProperty(tagId: LogseqEntityIdentity, propertyIdOrName: LogseqEntityIdentity): Promise<boolean>
removeTagProperty(tagId: LogseqEntityIdentity, propertyIdOrName: LogseqEntityIdentity): Promise<boolean>
addTagExtends(tagId: LogseqEntityIdentity, parentTagIdOrName: LogseqEntityIdentity): Promise<boolean>
removeTagExtends(tagId: LogseqEntityIdentity, parentTagIdOrName: LogseqEntityIdentity): Promise<boolean>
addBlockTag(blockId: LogseqEntityIdentity, tagId: LogseqEntityIdentity): Promise<boolean>
removeBlockTag(blockId: LogseqEntityIdentity, tagId: LogseqEntityIdentity): Promise<boolean>
```

### In-memory tag identity rules

Use tag names as the canonical in-memory identity for tag references. Store UUIDs for deterministic creation, but block properties and tag inheritance lists should use names.

Implement helpers:

```ts
resolveTagName(identity: LogseqEntityIdentity): string
resolvePropertyKey(identity: LogseqEntityIdentity): string
assertMutableTag(tagName: string): void
```

Resolution rules:

- String that matches an existing tag UUID resolves to that tag's name.
- String that matches an existing tag name resolves to itself.
- `{ uuid }` resolves through the tag map.
- Numeric `EntityID` should only resolve if imported metadata contains an ID-to-name mapping. Otherwise throw.
- Property references follow the same pattern using property key/name mappings.

### Built-in tag restrictions

`Page` / `#Page` is a built-in tag and must not be modified through the fakeable transaction layer.

Reject these operations when the target tag resolves to `Page`:

- `createTag`
- `addTagProperty`
- `removeTagProperty`
- `addTagExtends`
- `removeTagExtends`
- `addBlockTag`
- `removeBlockTag`

Use a single helper so the rule is consistent.

### createTag behavior

- If tag exists, reuse it and merge provided `tagProperties` idempotently.
- If tag does not exist, create a deterministic UUID unless `options.uuid` is supplied.
- For each `tagProperties` item:
  - Upsert the property schema.
  - Add the property key to `tag.tagProperties` if missing.
  - Preserve `properties` metadata on the property definition if useful for preview.

### addTagProperty / removeTagProperty

- Resolve tag to canonical tag name.
- Resolve property to canonical property key.
- Adding a missing property should either create a default schema or reject. Prefer mirroring Logseq behavior. If unclear, create a default property definition only when the property reference is a plain string key.
- Keep operations idempotent.

### addTagExtends / removeTagExtends

- Resolve child and parent tag names.
- Reject self-inheritance.
- Reject cycles in tag inheritance.
- Store parent tag names in `tag.extends`.

### addBlockTag / removeBlockTag

- Resolve the target block/page.
- Resolve tag name.
- Store tags in `entity.properties.tags` as normalized tag names.
- Keep tag lists unique and stable in insertion order.
- Do not add or remove `Page`.

### Tag inheritance

Do not physically copy inherited properties into `block.properties`; that would hide the distinction between actual values and schema availability.

Instead, add resolver helpers:

```ts
getTagPropertyKeys(tagName: string): string[]
getInheritedTagPropertyKeys(tagName: string): string[]
getEffectiveBlockPropertySchema(blockIdentity: LogseqEntityIdentity): Map<string, InMemoryPropertyDefinition>
```

The printer can display inherited schema availability separately from concrete block property values if needed.

### Commands

Add:

- `CreateTagCommand`
- `AddTagPropertyCommand`
- `RemoveTagPropertyCommand`
- `AddTagExtendsCommand`
- `RemoveTagExtendsCommand`
- `AddBlockTagCommand`
- `RemoveBlockTagCommand`

Update serializer and command exports.

## Import and Normalization

Current import loads pages and page block trees. It does not load all tag/property definitions.

Implement in stages:

### Stage 1: Normalize imported block/page property values

- Preserve existing direct properties.
- Normalize tag values in `properties.tags` to tag names when possible.
- Normalize property references in tag metadata when possible.

### Stage 2: Load metadata on demand

Extend `InMemoryPageLoader` or add a separate metadata loader:

```ts
export interface InMemoryMetadataLoader {
  loadProperty(keyOrIdentity: LogseqEntityIdentity): Promise<InMemoryPropertyDefinition | null>
  loadTag(nameOrIdentity: LogseqEntityIdentity): Promise<InMemoryTagDefinition | null>
}
```

Prefer a separate loader so existing page loading remains simple.

### Stage 3: Resolve IDs to names

- If Logseq returns property/tag IDs, resolve them through `logseq.Editor.getProperty`, `logseq.Editor.getTag`, `getAllProperties`, `getAllTags`, or datascript only if needed.
- Cache ID-to-name and UUID-to-name mappings in metadata DB.
- Throw when an ID cannot be resolved rather than storing opaque numeric IDs in preview output.

## Printer Changes

Keep `LogseqInMemoryDataPrinter.print(db: InMemoryDB)` working for existing tests.

Add an overload or options object:

```ts
LogseqInMemoryDataPrinter.print(db, { metadataDb })
```

Printing rules:

- Existing page/block output remains unchanged when no metadata is supplied.
- Block/page `properties` remain printed as `key:: value` lines, excluding internal `uuid`.
- `tags` property prints as names, preferably `[[TagName]]` for readability.
- Property definitions print in a separate section after normal pages.
- Tag definitions print in a separate section after property definitions.

Example shape:

```md
* Block
  tags:: [[Book]]
  rating:: 5

Properties
* rating
  type:: number
  cardinality:: one

Tags
* Book
  properties:: rating, author
  extends:: Media
```

Do not claim this is a full Logseq formatter. It is a review printer.

## Tool Layer

Update existing tools:

- `LogseqInsertBlockTool.tsx`: expose `before`, `sibling`, `start`, `end`.
- `LogseqMoveBlockTool.tsx`: expose `before`. Only expose `children` if in-memory semantics are implemented.

Add new tools only after executor/command behavior is tested:

- `LogseqUpsertPropertyTool`
- `LogseqRemovePropertyTool`
- `LogseqUpsertBlockPropertyTool`
- `LogseqRemoveBlockPropertyTool`
- `LogseqCreateTagTool`
- `LogseqAddTagPropertyTool`
- `LogseqRemoveTagPropertyTool`
- `LogseqAddTagExtendsTool`
- `LogseqRemoveTagExtendsTool`
- `LogseqAddBlockTagTool`
- `LogseqRemoveBlockTagTool`

If this creates too many model tools, consider a single `logseq_update_properties` tool and a single `logseq_update_tags` tool, but keep command classes granular internally.

## Files to Change

Core types and serialization:

- `types.ts`
- `LogseqTransactionExecutor.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`
- `LogseqFakeableTransactionTrackerSerializer.ts` only if tracker-level metadata must be serialized separately

Commands:

- `commands/InsertBlockCommand.ts`
- `commands/MoveBlockCommand.ts`
- `commands/index.ts`
- New property command files
- New tag command files

In-memory implementation:

- `executor/InMemoryExecutor.ts`
- `executor/in-memory-executor-utils/entityTree.ts`
- `executor/in-memory-executor-utils/entityFactory.ts`
- `executor/in-memory-executor-utils/normalizeLogseqEntity.ts`
- New `executor/in-memory-executor-utils/metadataStore.ts` or similar
- Optional new `executor/in-memory-executor-utils/InMemoryMetadataLoader.ts`

Real Logseq implementation:

- `executor/LogseqExecutor.ts`

Preview:

- `LogseqInMemoryDataPrinter.ts`

Tools:

- Existing insert/move tools
- New property/tag tools once core is stable

Tests:

- `tests/src/core/logseq-fakeable-transaction-tracker/InMemoryExecutor.test.ts`
- `tests/src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter.test.ts`
- New `entityTree.test.ts`
- New serializer tests for all new command types
- Tool tests if existing test infrastructure supports them

## Test Plan

Movement:

- Reject moving a block into its own descendant.
- Preserve original tree after failed move.
- Move block across pages and update subtree page refs.
- Insert block as first child, last child, sibling before, sibling after.
- Move block before another block.

Property schemas:

- Upsert creates a schema with deterministic UUID.
- Upsert existing key updates schema without changing UUID.
- Remove deletes schema definition.
- Serializer round trips property commands.

Block properties:

- Upsert property value on block.
- Remove property value on block.
- Reject removing internal `uuid`.
- Imported properties are preserved.

Tags:

- Create tag.
- Create tag with tag properties creates/links property schemas.
- Add/remove tag property.
- Add/remove tag extends.
- Reject tag inheritance cycles.
- Add/remove block tag.
- Normalize tags to names in memory.
- Reject modifications to `Page` / `#Page`.

Printer:

- Existing output remains unchanged without metadata.
- Tags print as readable names.
- Property schemas print in metadata section.
- Tag definitions print in metadata section.

## Implementation Order

1. Add movement safety and positioning support.
2. Add command serialization tests so future commands are safer to introduce.
3. Add metadata DB and property schema executor methods.
4. Add block property executor methods.
5. Add tag creation and tag-property methods.
6. Add tag inheritance, cycle prevention, and effective schema resolution.
7. Add printer metadata output.
8. Add import/normalization for property and tag metadata.
9. Add or update chat tools.

## Verification Commands

After implementation, run targeted checks:

```bash
pnpm test tests/src/core/logseq-fakeable-transaction-tracker/InMemoryExecutor.test.ts --run
pnpm test tests/src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter.test.ts --run
pnpm test tests/src/core/logseq-fakeable-transaction-tracker --run
npx tsc --noEmit
npm run check src/core/logseq-fakeable-transaction-tracker
npm run check:fix src/core/logseq-fakeable-transaction-tracker
```

## Error Handling

When a tool command fails in-memory execution, the tool returns a plain error object (not a `ToolResponse` with artifact), so the failed tracker is discarded and subsequent calls start fresh.
