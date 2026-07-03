# Block Command Schema & Restore-Position Changes

Status: **Specification — ready to implement.**

## Goal

Tighten the `MoveBlock`, `InsertBlock`, and `DeleteBlock` command schemas with explicit defaults and
validation, and make block restore (revert) position-accurate in **all** cases (first child, middle
child, last child, only child) using a previous-block + next-block snapshot.

## MoveBlock semantics (authoritative for this change)

`logseq.Editor.moveBlock(src, dest, opts)`:

| `children` | `before` | Result |
|------------|----------|--------|
| `false`    | `false`  | `src` becomes a **sibling immediately AFTER** `dest`. (default) |
| `false`    | `true`   | `src` becomes a **sibling immediately BEFORE** `dest`. |
| `true`     | —        | `src` becomes a **child** of `dest`. `before` is meaningless and **must be omitted**. |

### `MoveBlockCommandArgsSchema`

```ts
export const MoveBlockCommandArgsSchema = z.object({
    srcBlockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to move."),
    destBlockUuid: LogseqUUIDSchema.describe("UUID of the destination Logseq block."),
    before: z
        .boolean()
        .optional()
        .describe("Move src as a sibling BEFORE dest. Only meaningful with children=false. Omit when children=true."),
    children: z
        .boolean()
        .default(false)
        .describe("Make src a child of dest. When true, `before` must be omitted.")
}).refine(args => !(args.children === true && args.before !== undefined), {
    message: "`before` is meaningless when `children` is true. Omit `before`.",
    path: ["before"]
});
```

- Defaults: `children = false`, `before = undefined` (omitted).
- Default invocation `moveBlock(src, dest)` → sibling-after `dest`.
- Validation: reject when `children === true` AND `before` is present (any non-`undefined` value,
  including `false`). Callers must **omit** (not pass `false`) `before` when `children` is true.

## InsertBlock semantics (authoritative for this change)

`logseq.Editor.insertBlock(src, content, opts)`:

| `sibling` | `before` | Result |
|-----------|----------|--------|
| `true`    | `false`  | Insert as a **sibling AFTER** `src`. (default) |
| `true`    | `true`   | Insert as a **sibling BEFORE** `src`. |
| `false`   | —        | Insert as a **child** of `src`. `before` is meaningless and **must be omitted**. Use `start`/`end` for child positioning. |

### `InsertBlockCommandArgsSchema`

```ts
export const InsertBlockCommandArgsSchema = z.object({
    parentUuid: LogseqUUIDSchema.describe("UUID of the parent Logseq page or block."),
    content: z.string().describe("Content of the block to insert."),
    before: z
        .boolean()
        .optional()
        .describe("Insert before the anchor. Only meaningful with sibling=true. Omit when sibling=false."),
    sibling: z
        .boolean()
        .default(true)
        .describe("Insert as a sibling of the anchor block. When false, insert as a child and use start/end."),
    start: z.boolean().optional().describe("Insert as the FIRST child. Only valid when sibling=false."),
    end: z.boolean().optional().describe("Insert as the LAST child. Only valid when sibling=false.")
}).refine(args => !(args.sibling === false && args.before !== undefined), {
    message: "`before` is meaningless when `sibling` is false. Omit `before` and use start/end.",
    path: ["before"]
}).refine(args => !(args.sibling === true && (args.start !== undefined || args.end !== undefined)), {
    message: "`start`/`end` are only valid when `sibling` is false.",
    path: ["start"]
});
```

- Defaults: `sibling = true`, `before = undefined`.
- Default invocation `insertBlock(parent, content)` → sibling-after `parent`.
- Validation rules:
  - Reject when `sibling === false` AND `before` is present.
  - Reject when `sibling === true` AND (`start` or `end` is present).

> "Present" means any non-`undefined` value, including `false`. Meaningless options must be **omitted**,
> not passed as `false`.

## Restore-position strategy (Delete and Move revert)

Both `DeleteBlockCommand` and `MoveBlockCommand` snapshot the block's exact position at execute time
and replay it at revert time. The snapshot records the **previous block** and the **next block**, which
together cover every position case exactly.

### Snapshot

```ts
type BlockPositionSnapshot = {
    previousBlockUuid: string;     // previous sibling, OR the parent if the block was a first child
    isPreviousBlockParent: boolean; // true → previousBlockUuid is the parent (block was a first child)
    nextBlockUuid?: string;         // next sibling, undefined if the block was a last child
};
```

### Restore mapping (fully exact in all cases)

| Case | Condition | Restore call | Lands at |
|------|-----------|--------------|----------|
| Had a previous sibling | `isPreviousBlockParent === false` | `moveBlock(src, previousBlockUuid, {})` | sibling-after prev = exact slot |
| Was first child, has following siblings | `isPreviousBlockParent === true && nextBlockUuid` | `moveBlock(src, nextBlockUuid, {before: true})` | sibling-before next = first child |
| Was an only child (first AND last) | `isPreviousBlockParent === true && !nextBlockUuid` | `moveBlock(src, previousBlockUuid, {children: true})` | only child of parent = exact |

These calls go directly to `logseq.Editor.moveBlock`, bypassing the command schema, so the schema's
`children/before` mutual-exclusion rule does not interfere with the `{children: true}` and
`{before: true}` restore calls.

## `LogseqEditor` new methods

Add three static methods to `src/logseq/LogseqEditor.ts`. All wrap raw `logseq.Editor` calls and are
reused by both `DeleteBlockCommand` and `MoveBlockCommand`.

### `getPreviousBlock`

```ts
static async getPreviousBlock(blockIdentity: BlockIdentity): Promise<BlockEntity | PageEntity> {
    const previousSibling = await logseq.Editor.getPreviousSiblingBlock(blockIdentity);
    if (previousSibling) return previousSibling;
    // First child: fall back to the parent. For a page's first block, the raw SDK returns null where
    // it should surface the page; resolve the parent (page for root blocks, block otherwise).
    const block = await logseq.Editor.getBlock(blockIdentity);
    if (!block?.parent) throw new Error(`Block has no resolvable parent: ${JSON.stringify(blockIdentity)}`);
    return await resolveParentEntity(block.parent);
}
```

- Returns the **entity** (not an anchor): the previous sibling `BlockEntity`, or the parent
  (`BlockEntity` or `PageEntity`) when the block is a first child.
- Fixes the raw-SDK gap where `logseq.Editor.getPreviousSiblingBlock` returns `null` for a page's
  first block instead of surfacing the page.

### `getWhetherPreviousBlockIsParent`

```ts
static async getWhetherPreviousBlockIsParent(blockIdentity: BlockIdentity): Promise<boolean> {
    const previousSibling = await logseq.Editor.getPreviousSiblingBlock(blockIdentity);
    return !previousSibling;
}
```

- Returns `true` when the block is a first child (no previous sibling), meaning `getPreviousBlock`
  returns the parent. Returns `false` when a real previous sibling exists.

### `getNextBlock`

```ts
static async getNextBlock(blockIdentity: BlockIdentity): Promise<BlockEntity | null> {
    return await logseq.Editor.getNextSiblingBlock(blockIdentity);
}
```

- Thin wrapper around `logseq.Editor.getNextSiblingBlock`. Returns `null` when the block is a last
  child. Used to restore first-child position via `{before: true}`.

### Shared `resolveParentEntity` util

`getPreviousBlock` needs to resolve the parent entity (page for root blocks, block otherwise). This
logic already exists as `resolveParentUUID` inside
`src/core/logseq-reversible-transaction-tracker/commands/utils/normalizeBlock.ts:33`, but
`src/logseq/LogseqEditor.ts` (a lower layer) must not depend on command-layer code.

- Extract a shared `resolveParentEntity(reference)` (returning the entity, not just the uuid) into
  `src/logseq/utils/resolveParentEntity.ts`.
- Have `LogseqEditor.getPreviousBlock` use it.
- Refactor `normalizeBlock.resolveParentUUID` to delegate to the shared util (keep its uuid-returning
  signature, or migrate its callers to the shared util — prefer the latter to avoid two copies).

## `DeleteBlockCommand` changes

File: `src/core/logseq-reversible-transaction-tracker/commands/DeleteBlockCommand.ts`.

Replace `previousSiblingUuid` / `nextSiblingUuid` with the snapshot:

```ts
type DeletedBlockLocation = {
    previousBlockUuid: string;
    isPreviousBlockParent: boolean;
    nextBlockUuid?: string;
};
```

`execute`:

```ts
const block = await requireActiveBlock(this.args.blockUuid as BlockIdentity);
const previousBlock = await LogseqEditor.getPreviousBlock(block.uuid);
const isPreviousBlockParent = await LogseqEditor.getWhetherPreviousBlockIsParent(block.uuid);
const nextBlock = await LogseqEditor.getNextBlock(block.uuid);
this.deletedBlockLocation = {
    previousBlockUuid: previousBlock.uuid,
    isPreviousBlockParent,
    nextBlockUuid: nextBlock?.uuid
};
// ... existing temp-page move + deletePage flow unchanged
```

`revert` (after `restorePage`):

```ts
const {previousBlockUuid, isPreviousBlockParent, nextBlockUuid} = this.deletedBlockLocation;
if (!isPreviousBlockParent) {
    await logseq.Editor.moveBlock(this.args.blockUuid as BlockIdentity, previousBlockUuid as BlockIdentity, {});
} else if (nextBlockUuid) {
    await logseq.Editor.moveBlock(this.args.blockUuid as BlockIdentity, nextBlockUuid as BlockIdentity, {before: true});
} else {
    await logseq.Editor.moveBlock(this.args.blockUuid as BlockIdentity, previousBlockUuid as BlockIdentity, {children: true});
}
```

- Fixes the existing latent bug at `DeleteBlockCommand.ts:81-86` where the previous-sibling branch
  nested the restored block **inside** its previous sibling via `{children: true}`.

## `MoveBlockCommand` changes

File: `src/core/logseq-reversible-transaction-tracker/commands/MoveBlockCommand.ts`.

1. Apply the new `MoveBlockCommandArgsSchema` above.
2. Replace the lossy `originalParent`-only snapshot (`MoveBlockCommand.ts:23, 38, 53-61`) with the
   full position snapshot so revert restores exact sibling order:

```ts
private originalPreviousBlockUuid: string | undefined;
private originalIsPreviousBlockParent: boolean | undefined;
private originalNextBlockUuid: string | undefined;
```

`execute` (before the move):

```ts
const previousBlock = await LogseqEditor.getPreviousBlock(this.args.srcBlockUuid as BlockIdentity);
const isPreviousBlockParent = await LogseqEditor.getWhetherPreviousBlockIsParent(this.args.srcBlockUuid as BlockIdentity);
const nextBlock = await LogseqEditor.getNextBlock(this.args.srcBlockUuid as BlockIdentity);
this.originalPreviousBlockUuid = previousBlock.uuid;
this.originalIsPreviousBlockParent = isPreviousBlockParent;
this.originalNextBlockUuid = nextBlock?.uuid;
```

`revert`:

```ts
if (!this.originalIsPreviousBlockParent) {
    await logseq.Editor.moveBlock(srcBlockUuid, originalPreviousBlockUuid, {});
} else if (this.originalNextBlockUuid) {
    await logseq.Editor.moveBlock(srcBlockUuid, originalNextBlockUuid, {before: true});
} else {
    await logseq.Editor.moveBlock(srcBlockUuid, originalPreviousBlockUuid, {children: true});
}
```

This removes the current behavior where revert always makes `src` the **last** child of its original
parent, losing sibling order and first-child position.

## `InsertBlockCommand` changes

File: `src/core/logseq-reversible-transaction-tracker/commands/InsertBlockCommand.ts`.

Apply the new `InsertBlockCommandArgsSchema` above. No `execute` body change needed — it already
forwards `before/sibling/start/end` to `logseq.Editor.insertBlock`.

## Tool-wrapper impact

`src/chat-app/tools/impl/LogseqMoveBlockTool.tsx:30` and
`src/chat-app/tools/impl/LogseqInsertBlockTool.tsx:32` bind `parameters` directly to the schemas, so
they pick up the new defaults/validation automatically. The LLM-facing JSON schema changes:
`before` becomes optional (not required), `children` gains `default: false`, `sibling` gains
`default: true`. No code change required in the wrappers.

## Test impact

Update `tests/src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionSerializer.test.ts`:

- The round-trip test at line 127 constructs an `InsertBlockCommand` with explicit `sibling: false`
  and no `before`; this still serializes identically (`before` omitted, `sibling: false`).
- The bare `InsertBlockCommand({parentUuid, content})` at line 37 now defaults `sibling: true`; the
  assertion only checks `parentUuid`, so it still passes.

Add a new test file
`tests/src/core/logseq-reversible-transaction-tracker/commands/BlockCommandSchemas.test.ts` covering:

- `MoveBlockCommand`: defaults `{children: false, before: undefined}`; rejects
  `{children: true, before: true}` and `{children: true, before: false}`.
- `InsertBlockCommand`: defaults `{sibling: true, before: undefined}`; rejects
  `{sibling: false, before: true}`, `{sibling: false, before: false}`, `{sibling: true, start: true}`,
  `{sibling: true, end: true}`.

## Files to modify

- `src/logseq/LogseqEditor.ts` — add `getPreviousBlock`, `getWhetherPreviousBlockIsParent`,
  `getNextBlock`.
- `src/logseq/utils/resolveParentEntity.ts` (new) — shared parent-entity resolution.
- `src/core/logseq-reversible-transaction-tracker/commands/utils/normalizeBlock.ts` — delegate
  `resolveParentUUID` to the shared util.
- `src/core/logseq-reversible-transaction-tracker/commands/MoveBlockCommand.ts` — new schema +
  snapshot-based revert.
- `src/core/logseq-reversible-transaction-tracker/commands/InsertBlockCommand.ts` — new schema.
- `src/core/logseq-reversible-transaction-tracker/commands/DeleteBlockCommand.ts` — snapshot-based
  location and revert; drop `previousSiblingUuid`/`nextSiblingUuid`.
- `tests/src/core/logseq-reversible-transaction-tracker/commands/BlockCommandSchemas.test.ts` (new).

## Verification

```bash
pnpm test tests/src/core/logseq-reversible-transaction-tracker --run
npx tsc --noEmit
npm run check   src/logseq \
                src/core/logseq-reversible-transaction-tracker/commands \
                src/chat-app/tools/impl/LogseqMoveBlockTool.tsx \
                src/chat-app/tools/impl/LogseqInsertBlockTool.tsx
npm run check:fix src/logseq \
                src/core/logseq-reversible-transaction-tracker/commands \
                src/chat-app/tools/impl/LogseqMoveBlockTool.tsx \
                src/chat-app/tools/impl/LogseqInsertBlockTool.tsx
```
