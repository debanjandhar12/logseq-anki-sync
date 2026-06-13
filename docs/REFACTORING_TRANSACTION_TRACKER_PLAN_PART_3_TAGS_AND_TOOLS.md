# logseq-fakeable-transaction-tracker Refactoring Plan, Part 3: Tags, Printer, Tools, and Rollout

## Goal

Add tag/class support after movement and property support are stable, then expose the new capabilities through preview printing and tool-layer updates.

This part depends on:

- Part 1: safe movement and command option serialization.
- Part 2: metadata DB and property schema support.

## Scope

This part covers:

- Tag/class metadata model.
- Tag property links.
- Tag inheritance.
- Block/page tags.
- Import and normalization for tag metadata.
- Printer metadata output.
- Tool-layer updates.
- Final rollout order.

## SDK References

Relevant SDK signatures:

```ts
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
```

## Data Model

Extend the metadata DB from Part 2:

```ts
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

- Tags/classes are metadata for preview and validation, not normal block tree children.
- Tag properties and inheritance need graph-like validation that should not be mixed into the page/block tree.
- Store tag links by canonical tag name for readable previews and stable serialization.

## Executor Methods

Add to `LogseqTransactionExecutor`:

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

`LogseqExecutor` should call the matching `logseq.Editor.*` methods directly.

## In-Memory Tag Identity Rules

Use tag names as canonical in-memory identity for tag references. Store UUIDs for deterministic creation, but block properties and tag inheritance lists should use names.

Implement helpers:

```ts
resolveTagName(identity: LogseqEntityIdentity): string
resolvePropertyKey(identity: LogseqEntityIdentity): string
assertMutableTag(tagName: string): void
```

Resolution rules:

- String matching an existing tag UUID resolves to that tag's name.
- String matching an existing tag name resolves to itself.
- `{ uuid }` resolves through the tag map.
- Numeric `EntityID` resolves only if imported metadata contains an ID-to-name mapping.
- Throw when numeric IDs cannot be resolved.
- Property references follow the same pattern using property key/name mappings from Part 2.

## Built-In Tag Restrictions

`Page` / `#Page` is a built-in tag and must not be modified through the fakeable transaction layer.

Reject these operations when the target tag resolves to `Page`:

- `createTag`
- `addTagProperty`
- `removeTagProperty`
- `addTagExtends`
- `removeTagExtends`
- `addBlockTag`
- `removeBlockTag`

Use `assertMutableTag()` so this rule is centralized.

## Tag Behavior

### `createTag`

- If the tag exists, reuse it and merge provided `tagProperties` idempotently.
- If the tag does not exist, create a deterministic UUID unless `options.uuid` is supplied.
- Reject attempts to create or mutate built-in `Page`.
- For each `tagProperties` item, upsert the property schema using Part 2 behavior.
- Add the property key to `tag.tagProperties` if missing.
- Preserve `properties` metadata on the property definition if useful for preview.

### `addTagProperty` and `removeTagProperty`

- Resolve tag to canonical tag name.
- Resolve property to canonical property key.
- Adding a missing property should create a default property definition only when the property reference is a plain string key.
- Reject opaque or unresolved property identities.
- Keep operations idempotent.

### `addTagExtends` and `removeTagExtends`

- Resolve child and parent tag names.
- Reject self-inheritance.
- Reject cycles in tag inheritance.
- Store parent tag names in `tag.extends`.
- Keep `extends` stable in insertion order.

### `addBlockTag` and `removeBlockTag`

- Resolve the target block/page.
- Resolve tag name.
- Store tags in `entity.properties.tags` as normalized tag names.
- Keep tag lists unique and stable in insertion order.
- Do not add or remove `Page`.

## Tag Inheritance

Do not physically copy inherited properties into `block.properties`; that would hide the distinction between concrete values and schema availability.

Add resolver helpers:

```ts
getTagPropertyKeys(tagName: string): string[]
getInheritedTagPropertyKeys(tagName: string): string[]
getEffectiveBlockPropertySchema(blockIdentity: LogseqEntityIdentity): Map<string, InMemoryPropertyDefinition>
```

Printer behavior can use these helpers to display inherited schema availability separately from concrete block property values if needed.

## Commands

Add command classes:

- `CreateTagCommand`
- `AddTagPropertyCommand`
- `RemoveTagPropertyCommand`
- `AddTagExtendsCommand`
- `RemoveTagExtendsCommand`
- `AddBlockTagCommand`
- `RemoveBlockTagCommand`

Update:

- `commands/index.ts`
- `types.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`

Serialization requirements:

- Round-trip all tag commands.
- Preserve tag creation options, including `uuid` and `tagProperties`.
- Keep command payloads granular even if the UI later exposes grouped tools.

## Import and Normalization

Stage 1: normalize imported block/page tag values.

- Preserve existing direct properties.
- Normalize tag values in `properties.tags` to tag names when possible.
- Leave unresolved tag values untouched only when they are already readable strings.
- Throw on unresolved numeric tag IDs if they would be printed to users.

Stage 2: load metadata on demand.

Extend the metadata loader from Part 2:

```ts
export interface InMemoryMetadataLoader {
  loadProperty(keyOrIdentity: LogseqEntityIdentity): Promise<InMemoryPropertyDefinition | null>
  loadTag(nameOrIdentity: LogseqEntityIdentity): Promise<InMemoryTagDefinition | null>
}
```

Stage 3: resolve IDs to names.

- Resolve through `logseq.Editor.getTag`, `getAllTags`, `getTagObjects`, `getProperty`, or `getAllProperties` only when needed.
- Cache ID-to-name and UUID-to-name mappings in metadata DB.
- Throw when an ID cannot be resolved rather than storing opaque numeric IDs in preview output.

## Printer Changes

Keep the existing call working:

```ts
LogseqInMemoryDataPrinter.print(db)
```

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
- Inherited tag properties may print separately from concrete property values.

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

This is a review printer, not a full Logseq file formatter.

## Tool Layer

Update existing tools after Part 1 is implemented:

- `LogseqInsertBlockTool.tsx`: expose `before`, `sibling`, `start`, `end`.
- `LogseqMoveBlockTool.tsx`: expose `before`; do not expose `children` unless the product needs non-default behavior.

Add property tools after Part 2 is tested:

- `LogseqUpsertPropertyTool`
- `LogseqRemovePropertyTool`
- `LogseqUpsertBlockPropertyTool`
- `LogseqRemoveBlockPropertyTool`

Add tag tools after this part is tested:

- `LogseqCreateTagTool`
- `LogseqAddTagPropertyTool`
- `LogseqRemoveTagPropertyTool`
- `LogseqAddTagExtendsTool`
- `LogseqRemoveTagExtendsTool`
- `LogseqAddBlockTagTool`
- `LogseqRemoveBlockTagTool`

If this creates too many model-facing tools, expose a smaller UI surface such as `logseq_update_properties` and `logseq_update_tags`, but keep command classes granular internally.

## Files to Change

Core types and serialization:

- `types.ts`
- `LogseqTransactionExecutor.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`
- `LogseqFakeableTransactionTrackerSerializer.ts` only if metadata must be serialized separately

Commands:

- `commands/index.ts`
- New tag command files

In-memory implementation:

- `executor/InMemoryExecutor.ts`
- `executor/in-memory-executor-utils/metadataStore.ts`
- `executor/in-memory-executor-utils/normalizeLogseqEntity.ts`
- Optional `executor/in-memory-executor-utils/InMemoryMetadataLoader.ts`

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
- New serializer tests for all new command types
- Tool tests if existing infrastructure supports them

## Tests

Tags:

- Create tag.
- Create tag with tag properties creates/links property schemas.
- Add/remove tag property.
- Add/remove tag extends.
- Reject tag inheritance cycles.
- Reject self-inheritance.
- Add/remove block tag.
- Add/remove page tag if real SDK behavior is confirmed before implementation.
- Normalize tags to names in memory.
- Reject modifications to `Page` / `#Page`.

Printer:

- Existing output remains unchanged without metadata.
- Tags print as readable names.
- Property schemas print in metadata section.
- Tag definitions print in metadata section.
- Inherited schemas do not appear as concrete block property values.

Serializer:

- Round-trip every tag command.
- Round-trip mixed movement, property, and tag command history.

## Implementation Order

1. Implement Part 1 movement safety and positioning support.
2. Add command serialization tests so future command additions are safer.
3. Implement Part 2 metadata DB and property schema executor methods.
4. Implement Part 2 block/page property executor methods.
5. Add metadata-aware printer output for property definitions.
6. Implement tag creation and tag-property methods.
7. Implement tag inheritance, cycle prevention, and effective schema resolution.
8. Add tag-aware printer output.
9. Add import/normalization for property and tag metadata.
10. Add or update chat tools.

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

When a tool command fails in-memory execution, the tool returns a plain error object instead of a `ToolResponse` with an artifact. The failed tracker is discarded and subsequent calls start fresh.
