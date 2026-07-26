# Part 3: Transaction Tracker Changes

## Goal

Make tracker execution incremental and serial, persist command progress and state, and provide immediate reversion under one process-wide mutex.

## Scope

Primary files:

- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionOperationLockManager.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTracker.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTrackerSerializer.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionCommandQueue.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/BaseReversibleCommand.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/createReversibleCommandCodec.ts`
- Tracker barrel exports and tracker tests

## Global Operation Lock

Add `LogseqReversibleTransactionOperationLockManager.ts` with one static `AwaitLock`:

```ts
export class LogseqReversibleTransactionOperationLockManager {
    private static readonly lock = new AwaitLock();

    public static async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
        await this.lock.acquireAsync();
        try {
            return await operation();
        } finally {
            this.lock.release();
        }
    }
}
```

Use the existing `await-lock` dependency. Do not add a second mutex library unless the existing dependency cannot support the required browser build.

Do not expose raw lock acquisition and release. All callers use `runExclusive()`.

## Tracker Progress State

Replace replay-from-zero behavior with an applied command count:

```ts
private appliedCommandCount = 0;
```

Semantics:

- Commands before the count are currently applied.
- Commands at or after the count are not applied.
- Adding a command appends it without changing the count.
- A fully reverted tracker has a count of zero.
- A fully executed tracker has a count equal to the command count.
- Clearing the tracker removes all commands and resets the count.

Expose only the introspection needed by tools and the hook:

```ts
getAppliedCommandCount(): number;
hasAppliedGraphMutations(): boolean;
getChangedPages(): string[];
```

The tracker should retain the existing command queue order.

## Execute

`execute()` must acquire the static mutex before reading `appliedCommandCount` or command statuses.

Inside the locked operation:

1. Start at `appliedCommandCount`.
2. Execute only commands from that index onward.
3. Let each command validate that its status is `new`.
4. After each successful command, increment `appliedCommandCount`.
5. Accumulate changed pages.
6. Preserve the existing small Logseq commit delay between commands where it is still required.
7. Return the last newly executed command result.

If there are no remaining commands, return the existing no-op result expected by callers rather than replaying the command queue.

If a newly executed command fails after earlier new commands succeeded:

- Revert only commands applied during that execute call.
- Decrement `appliedCommandCount` after each successful rollback.
- Re-throw the original error.

The whole execute and rollback sequence remains under the same mutex.

The supplied abort signal should be checked before starting additional commands. It is not required to interrupt an individual Logseq API call.

## Immediate Revert

Replace the old public `revert()` operation with:

```ts
revertImmediately(options?: {signal?: AbortSignal}): Promise<boolean>;
```

The method acquires the static mutex before reading progress or command state.

Inside the locked operation:

1. Check the optional abort signal after acquiring the lock.
2. Start at `appliedCommandCount - 1`.
3. Revert only currently applied commands in reverse order.
4. Let each command validate that its status is `executed`.
5. After a successful command reversion, set its status to `new` and decrement the count.
6. Return when the count reaches zero.

If a Logseq API operation throws, propagate the error and preserve the count for the command that failed. Do not add a dedicated conflict abstraction or graph fingerprinting layer. Existing Logseq API errors are sufficient.

The method must not debounce. Debouncing is exclusively a React lifecycle concern.

## Command State And Tracker Invariants

The tracker serializer persists:

```ts
{
    version: 2,
    commands: SerializedLogseqReversibleCommand[],
    appliedCommandCount: number,
    changedPages: string[]
}
```

Each command persists:

```ts
{
    type: string,
    args: unknown,
    commandState: {
        status: "new" | "executed",
        ...commandSpecificState
    }
}
```

The serializer should validate the relationship between tracker progress and command status:

```text
index < appliedCommandCount  => status is executed
index >= appliedCommandCount => status is new
```

When a command is reverted, its status changes to `new`, but command-specific state may remain if it is useful for later re-execution.

## Serialization Compatibility

Existing thread messages contain the old flattened command shape and no execution progress. The deserializer must support those artifacts:

- Detect the old tracker shape.
- Convert flattened command arguments into `args`.
- Move generated identifiers into `commandState`.
- Set migrated commands to `status: "new"`.
- Set missing `appliedCommandCount` to zero.
- Set missing `changedPages` to an empty array.
- Emit only the new version-2 shape for new artifacts.

This is a one-way read migration. No new thread-level transaction store is introduced.

## Changed Pages

`changedPages` must be treated as tracker state rather than only transient runtime data.

When a command executes successfully, append its changed pages. When `execute()` has no remaining commands, retain the existing changed-page list so commit review can still print the affected pages after deserialization.

`clear()` resets commands, progress, and changed pages.

The hook and tools should use `hasAppliedGraphMutations()` rather than command-array length when deciding whether temporary graph changes exist, because read commands remain in the tracker.

## Clearing And Committing

Keep `clear()` as a local tracker reset, but callers must use it only in one of two safe situations:

- The tracker has already been reverted.
- The caller intentionally accepts the applied graph changes as a permanent commit.

The commit tool must cancel the lifecycle debounce before executing and clearing. The clear-changes tool must call `revertImmediately()` before clearing.

If a future public API combines graph execution and clearing, it should call the lock manager directly in that method rather than nesting `execute()` and `clear()` operations.

## Interaction With The Hook

The tracker does not know about React, timers, message branches, or assistant-ui.

The hook is responsible for:

- Calling `execute()` through mutation tool results.
- Scheduling delayed `revertImmediately()` calls.
- Passing an abort signal to invalidate stale scheduled callbacks.
- Persisting the updated artifact after a revert.
- Canceling scheduled cleanup during commit review and navigation.

The tracker only guarantees that concurrent execute and immediate-revert operations are serialized globally.

## Tests

Add or update tests for:

- First execute applying every command once.
- Second execute not replaying already applied commands.
- Appending a command after execution applying only the new command.
- Reverting only applied commands in reverse order.
- Updating command status during execute and immediate revert.
- Retaining command state needed for re-execution.
- Incremental execution failure rolling back only newly applied commands.
- Immediate revert failure preserving the failed command's applied count.
- Global lock serializing two tracker instances.
- Aborted immediate revert exiting after acquiring the lock.
- Tracker serialization round-tripping command state, progress, and changed pages.
- Legacy artifact migration.
- Read-only commands remaining in the queue without counting as graph mutations.

## Verification

Run the focused tests first:

```sh
pnpm test LogseqReversibleTransactionTracker --run
pnpm test LogseqReversibleTransactionSerializer --run
```

Then run the full required checks:

```sh
pnpm test --run
npx tsc --noEmit
```

Run Biome on every modified source file:

```sh
npm run check <modified-file>
npm run check:fix <modified-file>
```

Re-run the check and type check after formatting. Manually verify two sequential mutation tools, delayed cleanup, thread switching, thread reload cleanup, commit review, commit approval, and clear changes in a DB graph.

## Acceptance Criteria

- Execute applies only unapplied commands.
- Immediate revert applies only currently applied commands.
- All trackers share one static mutex.
- Commands serialize enough state to revert after an artifact round trip.
- Command codec boilerplate is centralized.
- No per-tracker debounce exists.
- The tracker remains independent of React and assistant-ui.
- Existing artifacts remain readable.
