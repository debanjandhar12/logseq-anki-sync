# Logseq Tags And Properties Tool Support Proposal

Status: **Partially implemented.** Property page and block property commands/tools are implemented. Tag commands/tools remain proposal-only.

## Summary

Add reversible transaction commands and chat tools for Logseq DB graph tags and properties.

This adds support for:

- Tag page creation.
- Property links on tag pages.
- Tag links on blocks.
- Property page upsert/delete.
- Property value upsert/delete on blocks.
- Reading tag and property pages through `LogseqReadBlockTool`.
- Normalizing tag references so tool results expose UUIDs the LLM can reuse.

The implementation should follow the current `logseq-reversible-transaction-tracker` architecture: tools append command objects to the tracker, execute the whole pending transaction for preview, immediately revert it, and return a serialized tracker artifact for later commit.

## Source Facts Checked

The local Logseq source at `/home/debanjand/Documents/Projects/logseq` confirms these API details:

- DB graph APIs are exported from `src/main/logseq/api.cljs` as `get_property`, `upsert_property`, `remove_property`, `create_tag`, `get_tag`, `add_block_tag`, `remove_block_tag`, `add_tag_property`, and `remove_tag_property`.
- `get_property` in `src/main/logseq/api/db_based.cljs` resolves a property from a sanitized property name/key through `-get-property`; it does not resolve a property by UUID.
- `upsert_property` creates or updates the property page and returns the property entity.
- `remove_property` deletes plugin/user property pages by resolving the property key and then deleting the property page UUID.
- `create_tag` creates a class/tag page and can accept `tagProperties` internally, but this proposal only exposes the requested `createTag(tagName)` API.
- `get_tag` resolves a tag from UUID, ident, or title and returns the tag entity when `ldb/class?` is true.
- `add_block_tag` and `remove_block_tag` resolve the tag through the tag resolver and mutate `:block/tags` on the target block.
- `add_tag_property` resolves the property by property identity/name and stores it in `:logseq.property.class/properties` on the tag page.
- `remove_tag_property` expects a tag and property that resolve to valid tag/property pages.
- `logseq.Editor.getPage` is backed by the same block lookup path and works for normal pages, tag pages, and property pages.
- `logseq.Editor.getBlock` can be used as the raw entity fetch for normal blocks and metadata pages when called with the needed options. When checking an arbitrary UUID, use the options required by the API to avoid filtering page entities.

Operational facts provided by the project owner:

- `createTag` can be reverted by deleting the returned tag page. Logseq hard-deletes the tag, and blocks using that tag automatically lose it.
- `removeBlockTag` removes properties that were auto-added because of that tag.
- Tool schemas should use UUIDs for entity identities, matching the existing block/page tools.

## Current Architecture

Relevant current files:

- `src/core/logseq-reversible-transaction-tracker/commands/*`
- `src/core/logseq-reversible-transaction-tracker/commands/index.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTracker.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqPageDataPrinter.ts`
- `src/chat-app/tools/impl/*Tool.tsx`
- `src/chat-app/tools/ToolRegistry.ts`
- `src/logseq/LogseqEditor.ts`
- `src/logseq/LogseqPropertiesHelper.ts`

Current command behavior:

- Commands extend `BaseReversibleCommand`.
- Commands serialize through `createReversibleCommandCodec`.
- Runtime rollback snapshots are private and not serialized.
- Durable command identity is serialized in command args or explicit readonly fields.
- `changedPages` drives commit review rendering through `LogseqPageDataPrinter`.

## SDK APIs To Support

Tags:

```ts
createTag(tagName: string): Promise<PageEntity | null>

addTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
removeTagProperty(tagId: BlockIdentity, propertyIdOrName: BlockIdentity): Promise<void>
addBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>
removeBlockTag(blockId: BlockIdentity, tagId: BlockIdentity): Promise<void>
```

Properties:

```ts
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

Do not introduce a broad metadata wrapper. Commands should call the relevant `logseq.Editor.*` APIs directly, except for narrowly scoped helpers on `LogseqEditor` where Logseq behavior needs normalization or a workaround.

## LogseqEditor Additions

Add only narrowly scoped helpers to `src/logseq/LogseqEditor.ts`.

### `LogseqEditor.getProperty`

Add `LogseqEditor.getProperty(propertyIndent)` as a narrow wrapper around `logseq.Editor.getProperty(propertyIndent)`.

Behavior:

1. Call `logseq.Editor.getProperty(propertyIndent)`.
2. Return the same entity shape returned by `logseq.Editor.getProperty`.

This method should not invent a custom property result type. Callers should type it around the real Logseq property entity return shape.

### `LogseqEditor.isTagBlock`

Add `isTagBlock(blockOrUuid)`.

Behavior:

- Return `true` when `logseq.Editor.getTag(uuid)` returns a tag entity.
- Return `false` when `getTag` returns null/undefined.
- Propagate unexpected API errors only if they are not normal "not a tag" behavior.

### `LogseqEditor.isPropertyBlock`

Add `isPropertyBlock(blockOrUuid)`.

Behavior:

- Resolve the UUID to a block entity when needed.
- Return `true` when the entity is a property page or has a Logseq `ident` that can be used with `LogseqEditor.getProperty`.
- Return `false` otherwise.

### Direct API Calls

Commands should call these APIs directly where possible:

- `logseq.Editor.createTag`
- `logseq.Editor.addTagProperty`
- `logseq.Editor.removeTagProperty`
- `logseq.Editor.addBlockTag`
- `logseq.Editor.removeBlockTag`
- `logseq.Editor.upsertProperty`
- `logseq.Editor.removeProperty`
- `logseq.Editor.upsertBlockProperty`
- `logseq.Editor.removeBlockProperty`

The installed plugin typings may not expose all APIs yet. Keep any casts or `@ts-expect-error` usage local to the command call sites or to existing `LogseqEditor` helper methods.

## Normalization

Tool results must expose UUIDs for follow-up tool calls. Logseq often returns tag references as entity IDs or raw entities; normalize them before returning command results.

### Normalized Tag Reference

Use this normalized tag reference shape in block/page/tag command results:

```ts
type NormalizedTagReference = {
  uuid: string
  tagName: string
}
```

### `normalizeTagPage`

Add `normalizeTagPage` near the existing normalization utilities.

Behavior:

- Accept the tag entity returned by `logseq.Editor.getTag`.
- Normalize the tag page with the same page/entity expectations used elsewhere.
- Normalize the tag page's own tags array to `NormalizedTagReference[]`.
- Keep tag-specific properties from the Logseq entity, including `:logseq.property.class/properties` where available.

The initial implementation can be intentionally small: normalize the tags array returned from `getTag`, preserve the rest of the entity, and validate that a UUID is present.

### `normalizeBlock` And `normalizePage`

Update both existing normalizers so `tags` are normalized to `NormalizedTagReference[]`.

Rules:

- If Logseq returns tag references as integers, resolve each integer to a tag page/entity and return `{ uuid, tagName }`.
- If Logseq returns tag references as objects, extract UUID and title/name.
- If a tag cannot be resolved to a UUID, throw instead of returning opaque IDs to the LLM.
- Preserve existing behavior for page/block UUID, page references, parent references, and children.

Commands must normalize returned blocks/pages/tags before returning tool-visible results. Do not move normalization into `LogseqEditor`; existing project patterns keep normalization in command utilities.

## Command Naming

Add these command classes.

Tag commands:

- `CreateTagPageCommand`
- `AddPropertyToTagPageCommand`
- `RemovePropertyFromTagPageCommand`
- `AddTagToBlockCommand`
- `RemoveTagFromBlockCommand`

Property commands:

- `UpsertPropertyPageCommand`
- `DeletePropertyPageCommand`
- `UpsertPropertyToBlockCommand`
- `DeletePropertyFromBlockCommand`

Use the same names for tool class names where practical.

## Tool Naming

Add matching tools.

Tag tools:

- `LogseqCreateTagPageTool` with name `logseq_create_tag_page`
- `LogseqAddPropertyToTagPageTool` with name `logseq_add_property_to_tag_page`
- `LogseqRemovePropertyFromTagPageTool` with name `logseq_remove_property_from_tag_page`
- `LogseqAddTagToBlockTool` with name `logseq_add_tag_to_block`
- `LogseqRemoveTagFromBlockTool` with name `logseq_remove_tag_from_block`

Property tools:

- `LogseqUpsertPropertyPageTool` with name `logseq_upsert_property_page`
- `LogseqDeletePropertyPageTool` with name `logseq_delete_property_page`
- `LogseqUpsertPropertyToBlockTool` with name `logseq_upsert_property_to_block`
- `LogseqDeletePropertyFromBlockTool` with name `logseq_delete_property_from_block`

Each tool should follow the existing pattern:

1. Load the latest tracker from message artifacts.
2. Add one command.
3. Execute the pending tracker.
4. Revert the pending tracker.
5. Return a `ToolResponse` with the updated tracker artifact.

## Command Schemas

Identity fields should use UUIDs only. Do not expose numeric `EntityID` or tag/property names as identities in tool schemas.

### `CreateTagPageCommand`

Args:

```ts
{
  tagName: string
}
```

Execution:

- Call `logseq.Editor.getTag(tagName)` first to determine whether the tag already exists.
- Call `logseq.Editor.createTag(tagName)`.
- Normalize the returned tag page with `normalizeTagPage` before returning it.
- Push the tag page UUID into `changedPages` when resolvable.

Revert:

- If the tag existed before execution, do nothing.
- If the tag was newly created, delete the returned tag page UUID with `logseq.Editor.deletePage`.
- Logseq hard-deletes the tag page and automatically removes the tag from blocks that used it.

### `AddPropertyToTagPageCommand`

Args:

```ts
{
  tagPageUuid: string
  propertyPageUuid: string
}
```

Execution:

- Use UUID-only identity fields.
- Snapshot whether the tag already had this property.
- Resolve the property page UUID through `LogseqEditor.getProperty` when a property key/name is needed.
- Call `logseq.Editor.addTagProperty(tagPageUuid, propertyPageUuid)`.
- Push the tag page UUID into `changedPages`.

Revert:

- If the relationship existed before, do nothing.
- If it was newly added, call `logseq.Editor.removeTagProperty(tagPageUuid, propertyPageUuid)`.

### `RemovePropertyFromTagPageCommand`

Args:

```ts
{
  tagPageUuid: string
  propertyPageUuid: string
}
```

Execution:

- Snapshot whether the relationship existed.
- Call `logseq.Editor.removeTagProperty(tagPageUuid, propertyPageUuid)`.
- Push the tag page UUID into `changedPages`.

Revert:

- If the relationship existed before execution, call `logseq.Editor.addTagProperty(tagPageUuid, propertyPageUuid)`.
- If it did not exist, do nothing.

### `AddTagToBlockCommand`

Args:

```ts
{
  blockUuid: string
  tagPageUuid: string
}
```

Execution:

- Snapshot whether the block already had the tag.
- Snapshot the block's existing properties before adding the tag.
- Call `logseq.Editor.addBlockTag(blockUuid, tagPageUuid)`.
- Fetch and normalize the changed block with `normalizeBlock` before returning it.
- Push the containing page UUID into `changedPages`.

Revert:

- If the tag already existed before execution, do nothing.
- Otherwise call `logseq.Editor.removeBlockTag(blockUuid, tagPageUuid)`.
- `removeBlockTag` removes properties auto-added by the tag. Restore only property values that existed before execution and were changed or removed by the tag operation.

### `RemoveTagFromBlockCommand`

Args:

```ts
{
  blockUuid: string
  tagPageUuid: string
}
```

Execution:

- Snapshot whether the block had the tag.
- Snapshot the block's existing properties before removing the tag.
- Call `logseq.Editor.removeBlockTag(blockUuid, tagPageUuid)`.
- Fetch and normalize the changed block with `normalizeBlock` before returning it.
- Push the containing page UUID into `changedPages`.

Revert:

- If the tag existed before execution, call `logseq.Editor.addBlockTag(blockUuid, tagPageUuid)`.
- Since adding the tag may auto-add properties, restore the original property snapshot after re-adding the tag.
- If the tag did not exist before execution, do nothing.

### `UpsertPropertyPageCommand`

Args:

```ts
{
  key: string
  schema?: Partial<PropertySchema>
  opts?: {
    name?: string
  }
}
```

Execution:

- `key` is not an entity identity; it is the Logseq property key required by `upsertProperty`.
- Snapshot any existing property page/schema for `key` using `logseq.Editor.getProperty(key)`.
- Call `logseq.Editor.upsertProperty(key, schema, opts)`.
- Read the resulting property through `logseq.Editor.getProperty(key)` and return that real Logseq property entity shape.
- Push the property page UUID into `changedPages` when resolvable.

Revert:

- If the property did not exist before execution, call `logseq.Editor.removeProperty(key)`.
- If it existed, restore the previous schema/name using `logseq.Editor.upsertProperty`.

### `DeletePropertyPageCommand`

Args:

```ts
{
  propertyPageUuid: string
}
```

Execution:

- Resolve `propertyPageUuid` to the property key through `LogseqEditor.getProperty`.
- Snapshot the property page/schema.
- Snapshot all block/page property values using this key.
- Call `logseq.Editor.removeProperty(key)`.
- Push the property page UUID and all affected page UUIDs into `changedPages`.

Revert:

- Recreate the property page/schema with `logseq.Editor.upsertProperty`.
- Restore all removed block/page property values with `logseq.Editor.upsertBlockProperty(..., { reset: true })`.

This command is the highest-risk operation because Logseq can cascade-delete property values. It needs focused tests against a DB graph.

### `UpsertPropertyToBlockCommand`

Args:

```ts
{
  blockUuid: string
  propertyPageUuid: string
  value: unknown
  options?: {
    reset?: boolean
  }
}
```

Execution:

- Resolve `propertyPageUuid` to the property key through `LogseqEditor.getProperty`.
- Reject attempts to mutate internal `uuid`.
- Snapshot whether the property existed on the block and its previous value.
- Call `logseq.Editor.upsertBlockProperty(blockUuid, key, value, options)`.
- Fetch and normalize the changed block with `normalizeBlock` before returning it.
- Push the containing page UUID into `changedPages`.

Revert:

- If the property existed, restore the previous value with `logseq.Editor.upsertBlockProperty(blockUuid, key, previousValue, { reset: true })`.
- If the property did not exist, call `logseq.Editor.removeBlockProperty(blockUuid, key)`.

### `DeletePropertyFromBlockCommand`

Args:

```ts
{
  blockUuid: string
  propertyPageUuid: string
}
```

Execution:

- Resolve `propertyPageUuid` to the property key through `LogseqEditor.getProperty`.
- Reject attempts to delete internal `uuid`.
- Snapshot whether the property existed and its previous value.
- Call `logseq.Editor.removeBlockProperty(blockUuid, key)`.
- Fetch and normalize the changed block with `normalizeBlock` before returning it.
- Push the containing page UUID into `changedPages`.

Revert:

- If the property existed, restore the previous value with `logseq.Editor.upsertBlockProperty(blockUuid, key, previousValue, { reset: true })`.
- If it did not exist, do nothing.

## Serialization

Update `src/core/logseq-reversible-transaction-tracker/commands/index.ts`:

- Import each new command codec.
- Export each new command class, args type, args input type, and args schema.
- Add each codec to `LogseqReversibleCommandCodec`.

Runtime-only rollback snapshots must not be serialized.

Serialized examples:

```json
{
  "type": "UpsertPropertyPage",
  "key": "rating",
  "schema": { "type": "number", "cardinality": "one" },
  "opts": { "name": "Rating" }
}
```

```json
{
  "type": "AddTagToBlock",
  "blockUuid": "018f38a5-df13-74d1-bf02-14c17f252f28",
  "tagPageUuid": "018f38a5-df13-74d1-bf02-14c17f252f29"
}
```

```json
{
  "type": "DeletePropertyFromBlock",
  "blockUuid": "018f38a5-df13-74d1-bf02-14c17f252f28",
  "propertyPageUuid": "018f38a5-df13-74d1-bf02-14c17f252f30"
}
```

## ReadLogseqBlock Support

Update `ReadBlockCommand` and `LogseqReadBlockTool` to support tag and property pages.

Current behavior:

- Reads a block/page by `uuid`.
- Returns `{ type: "block" | "page", block: ... }`.

Proposed behavior:

- Accept either `uuid` or `propertyIndent`; exactly one must be provided.
- Keep UUID-only identity input for block/page/tag reads and fallback property page auto-detection. Do not allow tag names or numeric entity IDs in the tool schema.
- `propertyIndent` is not an entity identity. It is the property ident/key required by `logseq.Editor.getProperty`.
- Do not add a manual entity type discriminator. Resolve property reads through `propertyIndent` first, then resolve UUID reads from Logseq metadata and the fallback order below.

Extended result should use real Logseq return types where possible:

```ts
type ReadBlockCommandResult =
  | { type: "tag"; block: Awaited<ReturnType<typeof logseq.Editor.getTag>> | null }
  | { type: "property"; block: Awaited<ReturnType<typeof LogseqEditor.getProperty>> | null }
  | { type: "page"; block: Omit<PageEntity, "children"> & { children?: BlockEntity[] } }
  | { type: "block"; block: BlockEntity | null }
```

The tag branch should normalize the `getTag` result with `normalizeTagPage` before returning it. The page and block branches should continue to normalize through `normalizePage` and `normalizeBlock` before returning results.

Resolution order:

1. If `propertyIndent` is provided, return `type: "property"` using `LogseqEditor.getProperty(propertyIndent)`.
2. If `LogseqEditor.isTagBlock(uuid)` returns true, return `type: "tag"` using `logseq.Editor.getTag(uuid)` and `normalizeTagPage`.
3. If `LogseqEditor.isPropertyBlock(uuid)` returns true, resolve the entity's `ident` and return `type: "property"` using `LogseqEditor.getProperty(ident)`.
4. If the raw entity is a normal content block, return `type: "block"` using `normalizeBlock`.
5. If `logseq.Editor.getPage(uuid)` returns a page, return `type: "page"` using `normalizePage` and optional page children.
6. Otherwise return `type: "block"` using `normalizeBlock`.

## Printer And Review Output

`LogseqPageDataPrinter` already prints normal page/block properties.

Add support for metadata pages by ensuring `changedPages` includes:

- Tag page UUIDs for tag operations.
- Property page UUIDs for property schema operations.
- Containing page UUIDs for block property and tag application operations.
- Affected page UUIDs for cascading property deletion.

If tag/property pages do not print useful information through `getPageBlocksTree`, add metadata-specific output in the printer.

Example review output:

```md
# Book
* tag-properties:: rating, author

# rating
* schema:: {"type":"number","cardinality":"one"}

# Reading List
* tags:: [{"uuid":"018f38a5-df13-74d1-bf02-14c17f252f29","tagName":"Book"}]
  rating:: 5
  Read Designing Data-Intensive Applications
```

## Files To Change

Core commands:

- `src/core/logseq-reversible-transaction-tracker/commands/CreateTagPageCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/AddPropertyToTagPageCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/RemovePropertyFromTagPageCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/AddTagToBlockCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/RemoveTagFromBlockCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/UpsertPropertyPageCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/DeletePropertyPageCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/UpsertPropertyToBlockCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/DeletePropertyFromBlockCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/ReadBlockCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/index.ts`
- `src/core/logseq-reversible-transaction-tracker/types.ts`

Normalization and Logseq helpers:

- `src/core/logseq-reversible-transaction-tracker/commands/utils/normalizeBlock.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/utils/normalizePage.ts`
- New `src/core/logseq-reversible-transaction-tracker/commands/utils/normalizeTagPage.ts`
- `src/logseq/LogseqEditor.ts`
- Optionally extend `src/logseq/LogseqPropertiesHelper.ts` only if existing property fetching needs to use normalized tag references.

Tools:

- `src/chat-app/tools/impl/LogseqCreateTagPageTool.tsx`
- `src/chat-app/tools/impl/LogseqAddPropertyToTagPageTool.tsx`
- `src/chat-app/tools/impl/LogseqRemovePropertyFromTagPageTool.tsx`
- `src/chat-app/tools/impl/LogseqAddTagToBlockTool.tsx`
- `src/chat-app/tools/impl/LogseqRemoveTagFromBlockTool.tsx`
- `src/chat-app/tools/impl/LogseqUpsertPropertyPageTool.tsx`
- `src/chat-app/tools/impl/LogseqDeletePropertyPageTool.tsx`
- `src/chat-app/tools/impl/LogseqUpsertPropertyToBlockTool.tsx`
- `src/chat-app/tools/impl/LogseqDeletePropertyFromBlockTool.tsx`
- `src/chat-app/tools/ToolRegistry.ts`
- `src/chat-app/tools/index.ts`

Preview:

- `src/core/logseq-reversible-transaction-tracker/LogseqPageDataPrinter.ts`

Tests:

- `tests/src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionSerializer.test.ts`
- New command tests under `tests/src/core/logseq-reversible-transaction-tracker/commands/`
- Existing `ReadBlockCommand.test.ts`
- Existing `LogseqPageDataPrinter.test.ts`

## Tests

Serializer tests:

- Round-trip every new command.
- Confirm runtime snapshots are not serialized.
- Confirm arbitrary property values round-trip through command serialization.
- Confirm UUID-only identity fields are serialized for tag/property relationship commands.

Property command tests:

- Upsert creates a property page/schema and returns the real `getProperty` entity shape.
- Upsert existing property restores previous schema on revert.
- Delete property page resolves the property key from UUID through `LogseqEditor.getProperty`.
- Delete property page restores schema on revert.
- Delete property page restores affected block/page values on revert.
- Upsert property to block restores previous value on revert.
- Delete property from block restores previous value on revert.
- Reject mutating/deleting internal `uuid`.

Tag command tests:

- Create tag creates and normalizes a tag page.
- Create tag revert deletes only newly created tags.
- Deleting a newly created tag removes that tag from blocks that used it.
- Add/remove property to/from tag page are reversible.
- Add/remove tag to/from block are reversible.
- Applying a tag auto-adds tag properties.
- Removing a tag removes tag-added properties.
- Revert restores pre-existing property values after tag side effects.

Read tests:

- Read normal block still works.
- Read normal page still works.
- Read tag page returns `type: "tag"` before it can be misclassified as a page or block.
- Read property page with `propertyIndent` returns `type: "property"`.
- Read property page UUID fallback returns `type: "property"` through `LogseqEditor.isPropertyBlock`.
- Invalid tag UUIDs and invalid property indents return the normal null read result for their branch.
- `includeChildren` behavior remains unchanged for normal pages/blocks.

Normalization tests:

- `normalizeBlock` converts integer tag references to `{ uuid, tagName }`.
- `normalizePage` converts integer tag references to `{ uuid, tagName }`.
- `normalizeTagPage` converts tag references to `{ uuid, tagName }`.
- Normalizers throw on unresolved numeric tag IDs.

Printer tests:

- Existing page/block output remains unchanged except normalized tag values.
- Tag pages print readable tag metadata.
- Property pages print schema metadata.

After implementation:

```bash
pnpm test tests/src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionSerializer.test.ts --run
pnpm test tests/src/core/logseq-reversible-transaction-tracker/commands/ReadBlockCommand.test.ts --run
pnpm test tests/src/core/logseq-reversible-transaction-tracker/commands --run
pnpm test tests/src/core/logseq-reversible-transaction-tracker/LogseqPageDataPrinter.test.ts --run
npx tsc --noEmit
npm run check <modified-files>
npm run check:fix <modified-files>
```

## Non-Goals

- Do not add tag inheritance support unless separately requested.
- Do not replace the current real-Logseq reversible tracker with an in-memory executor.
- Do not serialize runtime rollback snapshots.
- Do not change existing block/page command serialized shapes.
- Do not expose numeric `EntityID` or tag/property names as entity identities in tool schemas.
- Do not introduce a broad metadata wrapper.

## Remaining Implementation Checks

- Verify whether `removeTagProperty` accepts property page UUID directly in the plugin API. If not, resolve the property identity to the property key before calling it.
- Verify the exact property snapshot query needed to restore all affected values after `DeletePropertyPageCommand`.
