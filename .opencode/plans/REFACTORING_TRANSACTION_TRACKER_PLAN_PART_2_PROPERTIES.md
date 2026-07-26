# logseq-fakeable-transaction-tracker Refactoring Plan, Part 2: Properties

## Goal

Add property schema and block/page property value support to the fakeable transaction layer while keeping previews deterministic and commit behavior aligned with the real Logseq SDK.

This part depends on Part 1 for movement safety and command option serialization patterns.

## Existing Property Support

The codebase already has partial property support:

- `InMemoryBlockEntity` and `InMemoryPageEntity` already have `properties`.
- Imported blocks/pages already carry properties through `LogseqPropertiesHelper` and `normalizeLogseqEntity.ts`.
- `createPage(pageName, properties)` already supports initial page properties.
- `LogseqInMemoryDataPrinter` already prints non-`uuid` properties as `key:: value`.

Missing support:

- No property schema entities.
- No executor methods for `upsertProperty`, `removeProperty`, `upsertBlockProperty`, or `removeBlockProperty`.
- No commands or serializer support for those operations.
- No verified behavior for cardinality and cascading removal in the old plan.

## Verified Logseq Behavior

Verification was run against `POST http://127.0.0.1:12315/api` with the plugin HTTP API.

### Page property values

Live API verification:

- `logseq.Editor.upsertBlockProperty(pageUuid, key, value, { reset: true })` works for page UUIDs.
- `logseq.Editor.getBlockProperties(pageUuid)` returns page property values.

Implementation requirement:

- `InMemoryExecutor.upsertBlockProperty()` should accept both block and page targets.

### Many-cardinality property values

Live API verification:

- After `upsertProperty(key, { cardinality: 'many' })`, repeated `upsertBlockProperty(block, key, value, {})` appends values.
- `getBlockProperties(block)` returned the property value as an array in insertion order.

Implementation requirement:

- For known many-cardinality properties and `reset !== true`, append missing values while keeping insertion order.
- For `reset: true`, replace the property value.
- For unknown schema, use replacement unless the value already stored is an array and the intended operation is explicitly many-cardinality.

### Removing property schemas

Live API verification:

- `removeProperty(key)` removed the schema and removed existing values of that property from tested blocks.

Implementation requirement:

- `InMemoryExecutor.removeProperty()` should remove the property definition and cascade removal of that property key from imported and in-memory page/block `properties`.
- Do not remove internal `uuid`.

## SDK References

Relevant SDK signatures:

```ts
export type PropertySchema = {
  type: 'default' | 'number' | 'node' | 'date' | 'checkbox' | 'url' | string
  cardinality: 'many' | 'one'
  hide: boolean
  public: boolean
}

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

## Data Model

Keep the existing page/block tree as-is:

```ts
export type InMemoryDB = Map<string, InMemoryPageEntity>
```

Add a metadata store to `InMemoryExecutor` instead of changing every caller of `InMemoryDB`:

```ts
export type InMemoryPropertyDefinition = {
  uuid: string
  key: string
  name?: string
  type: 'property'
  schema: Partial<PropertySchema>
  properties: Record<string, any>
}

export type InMemoryMetadataDB = {
  properties: Map<string, InMemoryPropertyDefinition>
}
```

Part 3 extends `InMemoryMetadataDB` with tags.

Add accessors to `InMemoryExecutor`:

```ts
getInMemoryMetadataDb(): InMemoryMetadataDB
getOriginalInMemoryMetadataDb(): InMemoryMetadataDB
```

Rationale:

- Existing tests expect `getInMemoryPageDataDb()` to return `Map<string, InMemoryPageEntity>`.
- Property definitions are metadata for preview and validation, not normal block tree children.
- The printer can accept optional metadata when it needs schema output.

## Executor Methods

Add to `LogseqTransactionExecutor`:

```ts
upsertProperty(
  key: string,
  schema?: Partial<PropertySchema>,
  options?: { name?: string }
): Promise<boolean>

removeProperty(key: string): Promise<boolean>

upsertBlockProperty(
  block: LogseqEntityIdentity,
  key: string,
  value: any,
  options?: Partial<{ reset: boolean }>
): Promise<boolean>

removeBlockProperty(block: LogseqEntityIdentity, key: string): Promise<boolean>
```

`LogseqExecutor` behavior:

- `upsertProperty` calls `logseq.Editor.upsertProperty(key, schema, options)`.
- `removeProperty` calls `logseq.Editor.removeProperty(key)`.
- `upsertBlockProperty` calls `logseq.Editor.upsertBlockProperty(block, key, value, options)`.
- `removeBlockProperty` calls `logseq.Editor.removeBlockProperty(block, key)`.

## In-Memory Property Schema Behavior

`upsertProperty`:

- Creates or updates `metadata.properties` keyed by stable property key.
- Generates deterministic UUIDs for newly created property definitions.
- Preserves the existing property definition UUID on repeated upsert.
- Stores display name from `options.name` separately from the stable key.
- Merges schema updates into the existing schema.

`removeProperty`:

- Removes the schema definition.
- Cascades removal of that property key from all imported and in-memory pages/blocks.
- Does not remove internal `uuid`.

## In-Memory Block/Page Property Behavior

`upsertBlockProperty`:

- Resolve the target with existing identity helpers/import flow.
- Reject if the target is missing.
- Accept page and block targets.
- Initialize `entity.properties` when missing.
- If `options.reset === true`, set `properties[key] = value`.
- If the property schema has `cardinality: 'one'`, set `properties[key] = value`.
- If the property schema has `cardinality: 'many'` and `reset !== true`, append the value if it is not already present.
- Keep many-cardinality arrays stable in insertion order.
- If schema is unknown, replace the value by default to avoid inventing many-cardinality behavior.

`removeBlockProperty`:

- Deletes `properties[key]`.
- Rejects attempts to remove internal `uuid`.

## Commands

Add command classes:

- `UpsertPropertyCommand`
- `RemovePropertyCommand`
- `UpsertBlockPropertyCommand`
- `RemoveBlockPropertyCommand`

Update:

- `commands/index.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`
- `SerializedLogseqFakeableCommand` in `types.ts`

Serialization requirements:

- Round-trip schema objects without losing unknown valid Logseq schema fields.
- Round-trip arbitrary property values supported by Logseq JSON serialization.
- Keep existing serialized commands backward compatible.

## Import and Normalization

Stage 1:

- Preserve existing direct properties on imported pages and blocks.
- Preserve property values exactly unless a known normalization rule exists.
- Never store opaque numeric property IDs in preview output if a name/key can be resolved.

Stage 2:

- Add a separate metadata loader instead of complicating page loading:

```ts
export interface InMemoryMetadataLoader {
  loadProperty(keyOrIdentity: LogseqEntityIdentity): Promise<InMemoryPropertyDefinition | null>
}
```

Stage 3:

- Resolve property IDs through `logseq.Editor.getProperty`, `getAllProperties`, or datascript only if needed.
- Cache ID-to-key and UUID-to-key mappings in metadata DB.
- Throw when an ID cannot be resolved rather than printing opaque numeric IDs.

## Files to Change

Core types and serialization:

- `types.ts`
- `LogseqTransactionExecutor.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`
- `LogseqFakeableTransactionTrackerSerializer.ts` only if metadata must be serialized separately from command history

Commands:

- `commands/index.ts`
- New property command files

In-memory implementation:

- `executor/InMemoryExecutor.ts`
- `executor/in-memory-executor-utils/normalizeLogseqEntity.ts`
- New `executor/in-memory-executor-utils/metadataStore.ts` or similar
- Optional new `executor/in-memory-executor-utils/InMemoryMetadataLoader.ts`

Real Logseq implementation:

- `executor/LogseqExecutor.ts`

Preview:

- `LogseqInMemoryDataPrinter.ts` when metadata output is added

## Tests

Property schemas:

- Upsert creates a schema with deterministic UUID.
- Upsert existing key updates schema without changing UUID.
- Remove deletes schema definition.
- Remove cascades property value deletion across pages and blocks.
- Serializer round-trips property commands.

Block/page properties:

- Upsert property value on block.
- Upsert property value on page.
- Remove property value on block.
- Remove property value on page.
- Reject removing internal `uuid`.
- Imported properties are preserved.
- Many-cardinality upsert appends missing values in order.
- Many-cardinality upsert does not duplicate existing values.
- `reset: true` replaces many-cardinality values.
- Unknown schema defaults to replacement.

## Verification Commands

After implementation, run:

```bash
pnpm test tests/src/core/logseq-fakeable-transaction-tracker/InMemoryExecutor.test.ts --run
pnpm test tests/src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter.test.ts --run
pnpm test tests/src/core/logseq-fakeable-transaction-tracker --run
npx tsc --noEmit
npm run check src/core/logseq-fakeable-transaction-tracker
npm run check:fix src/core/logseq-fakeable-transaction-tracker
```
