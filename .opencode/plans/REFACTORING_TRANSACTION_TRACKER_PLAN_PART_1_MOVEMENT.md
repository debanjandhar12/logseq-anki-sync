# logseq-fakeable-transaction-tracker Refactoring Plan, Part 1: Movement and Positioning

## Goal

Make block movement and insertion safe, deterministic, and close to real Logseq SDK behavior before adding property and tag features.

This part covers:

- Unsafe movement edge cases.
- Cross-page block movement.
- `insertBlock` positioning options.
- `moveBlock` positioning options.
- Page movement decisions.

## Current Architecture

The module already has the correct high-level shape:

- `LogseqFakeableTransactionTracker` stores queued `LogseqFakeableCommand` instances.
- Each command executes against either `InMemoryExecutor` or `LogseqExecutor`.
- `InMemoryExecutor` mutates an in-memory page/block tree for preview.
- `LogseqExecutor` applies approved changes through real `logseq.Editor.*` APIs.
- `LogseqFakeableTransactionCommandSerializer` serializes command history.
- `LogseqInMemoryDataPrinter` prints the in-memory DB for review.

Do not replace this architecture. Extend it with the smallest surface needed.

## Verified Logseq Behavior

Verification was run against `POST http://127.0.0.1:12315/api` with the plugin HTTP API.

### `insertBlock` with `before: true` and no `sibling`

Source inspection: `logseq-source/src/main/logseq/api/editor.cljs`, `insert_block`.

Live API verification:

- If the source block has children, `insertBlock(src, content, { before: true })` inserts the new block as the first child of `src`.
- If the source block has no children, it inserts the new block as a sibling immediately before `src`.

Implementation requirement:

- Mirror this behavior exactly in `InMemoryExecutor.insertBlock()`.
- Do not reject this option combination.

### `moveBlock` default and `children`

Source inspection: `logseq-source/src/main/logseq/api/editor.cljs`, `move_block`.

Live API verification:

- `moveBlock(src, target, {})` did not perform the existing expected nested move in the tested API path.
- `moveBlock(src, target, { children: false })` also did not perform the nested move.
- `moveBlock(src, target, { children: true })` moved `src` under `target` and kept `src` descendants attached.
- `moveBlock(src, target, { before: true })` moved `src` as a sibling immediately before `target`.

Implementation requirement:

- `LogseqExecutor.moveBlock()` must pass `{ children: true, ...options }` for the existing transaction-layer default of moving a block under the destination.
- `InMemoryExecutor.moveBlock()` should treat omitted options as nested move with descendants, matching the transaction layer contract, not the raw SDK omission behavior.
- Reject `children: false` in memory until there is a real product need and a verified intended UX for that option.

### Page movement

Live API verification:

- `moveBlock(pageUuid, targetPageUuid, {})` returned without a useful parentage change in the tested setup.
- No SDK page-parenting API was identified in the inspected SDK surface.

Implementation requirement:

- Do not implement fake `movePage` behavior now.
- Do not let in-memory pages be physically nested under blocks or pages unless a real Logseq API that commits the same behavior is identified.
- If page hierarchy is needed later, implement a supported operation such as `renamePage` for namespace-style hierarchy or `movePageBlocks(sourcePage, destinationPage)`.

## SDK References

Use these files as source-of-truth references:

- `logseq-source/libs/src/LSPlugin.ts`
- `logseq-source/libs/cljs-sdk/src/com/logseq/editor.cljs`
- `logseq-source/src/main/logseq/api/editor.cljs`

Relevant SDK signatures:

```ts
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
```

## Design Principles

- Preserve the current Command + Dual-Executor architecture.
- In-memory behavior should fail fast when it detects an operation Logseq would reject or the real executor cannot commit.
- The transaction-layer default for `moveBlock(src, dest)` remains “move `src` under `dest` with descendants”. The real executor enforces that by passing `children: true`.
- Do not silently normalize invalid identities.
- Keep preview output deterministic and reviewable.

## Movement Safety

### Prevent moving a block into its own subtree

Current behavior is unsafe. `moveBlock(root, grandchild)` can create a cycle because the destination is looked up after detaching.

Implement in `executor/in-memory-executor-utils/entityTree.ts`:

```ts
isDescendantOf(entity: InMemoryLogseqEntity, possibleAncestor: InMemoryLogseqEntity): boolean
findParentOfEntity(db: InMemoryDB, identity: LogseqEntityIdentity): InMemoryLogseqEntity | null
findParentAndIndex(db: InMemoryDB, identity: LogseqEntityIdentity): { parent: InMemoryLogseqEntity; index: number } | null
```

In `InMemoryExecutor.moveBlock()`:

- Import source and destination pages first.
- Resolve source and destination before detaching anything.
- If destination is inside source's subtree, throw `Cannot move a block inside its own subtree`.
- Leave the original tree unchanged after rejection.
- Then detach and reinsert.

Tests:

- `moveBlock(root, child)` rejects.
- The original tree remains unchanged after rejection.

### Cross-page block movement

Add dedicated regression coverage. The implementation appears intended to support this but lacks explicit tests.

Tests:

- Moving a root block from Page A under a block on Page B succeeds.
- Source page no longer contains the moved block.
- Moved block's `parent` points to the destination block.
- Moved block and all descendants have `page` pointing to Page B.

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

In `LogseqExecutor`, pass through these options plus deterministic `customUUID`:

```ts
logseq.Editor.insertBlock(parentBlockUUID, content, {
  ...options,
  customUUID: this.uuidGenerator.getUUID()
})
```

In `InMemoryExecutor`, implement these semantics:

- Default: insert as last child of `srcBlock`.
- `start: true`: insert as first child of `srcBlock`.
- `end: true`: insert as last child of `srcBlock`.
- `sibling: true`: insert as sibling of `srcBlock`.
- `sibling: true, before: true`: insert before `srcBlock`.
- `sibling: true, before: false`: insert after `srcBlock`.
- `before: true` without `sibling`, when `srcBlock` has children: insert as first child of `srcBlock`.
- `before: true` without `sibling`, when `srcBlock` has no children: insert as sibling immediately before `srcBlock`.

Add helpers:

```ts
insertChildAt(parent, child, index)
insertSibling(db, targetIdentity, child, before)
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

In `LogseqExecutor`, pass `{ children: true, ...options }`.

In `InMemoryExecutor`:

- Default: move source as last child of destination, preserving descendants.
- `children: true`: same as default.
- `before: true`: move source as sibling immediately before destination, preserving descendants.
- `children: false`: throw a clear unsupported-operation error.

Update:

- `LogseqTransactionExecutor.ts`
- `executor/LogseqExecutor.ts`
- `executor/InMemoryExecutor.ts`
- `commands/InsertBlockCommand.ts`
- `commands/MoveBlockCommand.ts`
- `LogseqFakeableTransactionCommandSerializer.ts`
- `types.ts`
- `LogseqInsertBlockTool.tsx`
- `LogseqMoveBlockTool.tsx`

## Tests

Movement:

- Reject moving a block into its own descendant.
- Preserve original tree after failed move.
- Move block across pages and update subtree page refs.
- Move block under destination by default through the transaction-layer API.
- Move block under destination with `children: true`.
- Reject `children: false`.
- Move block before another block with `before: true`.

Insertion:

- Insert as first child with `start: true`.
- Insert as last child with `end: true`.
- Insert sibling before with `sibling: true, before: true`.
- Insert sibling after with `sibling: true, before: false`.
- Insert first child with `before: true` and no `sibling` when source has children.
- Insert sibling before with `before: true` and no `sibling` when source has no children.

Serializer:

- Round-trip insert command options.
- Round-trip move command options.
- Preserve backward compatibility when old serialized commands omit options.

## Verification Commands

After implementation, run:

```bash
pnpm test tests/src/core/logseq-fakeable-transaction-tracker/InMemoryExecutor.test.ts --run
pnpm test tests/src/core/logseq-fakeable-transaction-tracker --run
npx tsc --noEmit
npm run check src/core/logseq-fakeable-transaction-tracker
npm run check:fix src/core/logseq-fakeable-transaction-tracker
```
