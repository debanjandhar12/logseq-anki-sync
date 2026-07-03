# Reversible Transaction Tracker UUID State Proposal

Status: **Implemented.**

## Problem

The current transaction tracker uses one transaction-level `DeterministicUUIDGenerator`. Each
`execute()` starts the generator from the same seed and each command consumes UUIDs in queue order.

This works only while the same command objects stay in memory. It breaks down when tracker artifacts
are serialized into chat history, deserialized later, and then executed or reverted again.

Example failure:

```json
{
    "error": "Failed to insert Logseq block under \"67dc3287-f0ac-5861-8a8c-6524460bf743\": Page already exists as deleted: Charmender"
}
```

The real flow is:

1. `CreatePageCommand({pageName: "Charmender"})` executes and creates a page.
2. The tracker reverts, so Logseq keeps the page as a soft-deleted DB graph entity.
3. The tracker is serialized into an artifact.
4. A later tool call deserializes the tracker and appends `InsertBlockCommand`.
5. The new execution tries to run `CreatePageCommand` again.
6. The command sees a soft-deleted page named `Charmender`, but after deserialization it no longer
   knows whether that deleted page belongs to this command.
7. It refuses to restore the page and throws `Page already exists as deleted: Charmender`.

## Root Cause

The serialized command data currently stores command inputs, not command identity or execution state.

For create-style commands, the UUID is not just an implementation detail. It is the durable identity
of the Logseq entity created by the command. If that identity is lost, the command cannot safely
distinguish these cases:

| Case | Safe behavior |
|------|---------------|
| Soft-deleted page was created by this command | Restore it and continue. |
| Soft-deleted page existed before this command | Throw to avoid hijacking unrelated user data. |
| Active page already exists with same name | Throw unless it is known to be the command's own entity. |

The deterministic generator can recreate UUIDs only if every command consumes UUIDs in exactly the
same order forever. That is fragile because command order, command internals, retries, migration, and
partial execution state all affect the cursor.

## Recommendation

Move from transaction-level deterministic UUID generation to command-owned persisted UUIDs.

Each command that creates a Logseq entity should own and serialize the UUIDs of entities it is
responsible for creating. The UUID should be generated once when the command is constructed or decoded
without an existing UUID, then reused for every execute/revert cycle.

Recommended rule:

> If a command needs an entity UUID to execute, revert, restore, validate ownership, or allow later
> commands to reference its output, that UUID belongs in the command's serialized data.

## Proposed Model

### Command Args vs Command State

Split command data into two conceptual groups.

```ts
type CommandArgs = {
    // User/model intent. Stable and human meaningful.
};

type CommandState = {
    // Runtime identity and snapshots required to re-execute or revert after serialization.
};
```

Both groups should be serialized in artifacts. They can stay in one JSON object for codec simplicity,
but the code should keep the distinction clear.

### CreatePageCommand

```ts
type SerializedCreatePageCommand = {
    type: "CreatePage";
    pageName: string;
    pageUuid: string;
    status?: "pending" | "executed" | "reverted";
};
```

Execution behavior:

1. If no page with `pageName` exists, call `logseq.Editor.createPage` with `customUUID: pageUuid`.
2. If a soft-deleted page exists and its UUID equals `pageUuid`, restore it.
3. If an active page exists and its UUID equals `pageUuid`, treat it as already applied or return it.
4. If any page exists with the same name but a different UUID, throw.

Revert behavior:

1. Resolve by `pageUuid`, not only by name.
2. Delete the page if it is active.
3. Treat an already soft-deleted page with the same UUID as already reverted.
4. Throw if the page is missing in a way that makes ownership unclear.

### InsertBlockCommand

```ts
type SerializedInsertBlockCommand = {
    type: "InsertBlock";
    parentUuid: string;
    content: string;
    before?: boolean;
    sibling: boolean;
    start?: boolean;
    end?: boolean;
    blockUuid: string;
    status?: "pending" | "executed" | "reverted";
};
```

Execution behavior:

1. Validate the parent exists and is active.
2. Insert with `customUUID: blockUuid`.
3. If the block already exists with `blockUuid`, decide based on status and content whether this is an
   idempotent retry or a conflict.

Revert behavior:

1. Remove `blockUuid` if it exists.
2. Treat a missing block as already reverted only if that behavior is explicitly accepted.

### Update/Delete/Move Commands

Commands that mutate existing entities do not need generated UUIDs, but they do need serialized
snapshots if they must survive artifact round trips.

Examples:

| Command | Persisted state |
|---------|-----------------|
| `UpdateBlockCommand` | Original content/properties needed to restore. |
| `DeleteBlockCommand` | Deleted block content, properties, children, and restore position. |
| `DeletePageCommand` | Page UUID, page data, block tree, and restore metadata. |
| `MoveBlockCommand` | Original parent/position snapshot. |
| `RenamePageCommand` | Original page UUID/name and target page UUID/name. |

This is the same principle: if revert requires it after deserialization, serialize it.

## Tracker Changes

The tracker should stop owning UUID allocation.

Current shape:

```ts
class LogseqReversibleTransactionTracker {
    private UUID_GENERATION_SEED: string;

    async execute() {
        const generator = new DeterministicUUIDGenerator(this.UUID_GENERATION_SEED);
        for (const command of commands) {
            await command.execute(generator);
        }
    }
}
```

Proposed shape:

```ts
class LogseqReversibleTransactionTracker {
    async execute() {
        for (const command of commands) {
            await command.execute();
        }
    }
}
```

The tracker should remain responsible for:

1. Command ordering.
2. Rollback of commands that executed during a failed transaction.
3. Tracking changed pages.
4. Serialization of command list and tracker-level metadata.

The tracker should not be responsible for generating entity IDs.

## Why This Is Better Than Deterministic UUIDs

| Criterion | Deterministic generator | Serialized command UUIDs |
|-----------|--------------------------|---------------------------|
| Survives serialization | Only if cursor and runtime state are reconstructed perfectly. | Yes, UUIDs are explicit. |
| Supports appending commands after revert | Fragile. Earlier commands must replay identically. | Stable. Later commands can reference known UUIDs. |
| Debuggability | Hard to know which command consumed which UUID. | Artifact shows exact entity identities. |
| Migration safety | Command implementation changes can shift UUID consumption. | Command UUIDs remain stable. |
| Ownership validation | Requires recomputation and assumptions. | Direct UUID comparison. |
| Revert after deserialize | Requires extra generated context. | Command has its own target UUID. |

The only strong advantage of deterministic UUIDs is compact artifacts. That is not worth the hidden
state coupling.

## Artifact Shape

The plugin is unreleased, so no artifact versioning or migration path is needed. Tracker artifacts can
use the new command shape directly.

```ts
type SerializedLogseqReversibleTransactionTracker = {
    commands: SerializedLogseqReversibleCommand[];
};
```

## Tool Contract Changes

Tools should not ask the model to provide UUIDs for newly created entities. The application should
generate UUIDs internally.

A tool can return the generated UUID in its artifact/result so later tool calls can reference it.

Example tool result:

```json
{
    "pageName": "Charmender",
    "pageUuid": "67dc3287-f0ac-5861-8a8c-6524460bf743"
}
```

This makes follow-up commands deterministic without asking the LLM to invent IDs.

## Implementation Plan

1. Remove `DeterministicUUIDGenerator` from the command execution API.
2. Add command-owned UUID state to create-style commands.
3. Generate missing command UUIDs in constructors or codec decode paths.
4. Serialize all command state required for revert after artifact round trip.
5. Update `CreatePageCommand` restore logic to compare soft-deleted page UUID against `pageUuid`.
6. Update `InsertBlockCommand` to use serialized `blockUuid` as `customUUID`.
7. Add tests that serialize and deserialize between execute/revert cycles.
8. Add conflict tests for same-name/different-UUID pages and same-UUID idempotent retries.
9. Remove transaction seed fields.

## Regression Tests Needed

1. Execute `CreatePageCommand`, revert, serialize, deserialize, append `InsertBlockCommand`, execute,
   revert.
2. Execute `CreatePageCommand`, serialize, deserialize, revert.
3. Execute `InsertBlockCommand`, serialize, deserialize, revert.
4. Soft-deleted page with same name and different UUID must throw.
5. Soft-deleted page with same name and same UUID must restore.
6. Active page with same name and different UUID must throw.
7. Reordering commands must not change generated UUIDs for already serialized commands.

## Open Questions

1. Should repeated `execute()` on an already active command be idempotent or always throw?
2. Should repeated `revert()` on an already reverted command be idempotent or always throw?
3. Do we need to migrate existing chat artifacts, or can we treat old artifacts as invalid?
4. Should command status be persisted, or should commands infer state from Logseq entities?

## Recommendation Summary

Persist UUIDs directly on commands and phase out transaction-level deterministic UUID generation.
Deterministic UUIDs hide command identity in execution order, which is exactly the wrong abstraction
for serialized reversible transactions. Command-owned UUIDs make artifacts self-contained, debuggable,
and safe to replay after revert or deserialization.
