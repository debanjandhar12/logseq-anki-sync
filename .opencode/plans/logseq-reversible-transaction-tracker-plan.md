# Logseq Reversible Transaction Tracker Plan

## Problem

`LogseqReversibleTransactionTracker` currently treats every preview or commit as a full transaction replay:

- `execute()` iterates every queued command from the beginning.
- `revert()` iterates every queued command in reverse.
- Tool calls usually do `execute()` followed immediately by `revert()`.
- Commit review does `execute()`, captures the after state, `revert()`, then approval calls `execute()` again.

This creates repeated write/delete/write cycles against the Logseq graph. When multiple tool calls, UI renders, or review actions happen close together, this can corrupt or destabilize the Logseq database.

## Goals

- Track how far the queued command list has already been executed.
- Execute only commands that have not already been executed.
- Revert only commands that are currently applied.
- Replace immediate per-tool revert with debounced scheduled revert.
- Preserve the existing artifact-based tracker flow across assistant messages.
- Keep the final commit path explicit and safe.

## Non-Goals

- Do not redesign individual command implementations unless progress tracking exposes command-level bugs.
- Do not introduce persistent background jobs outside the current chat/tool lifecycle.
- Do not add backward compatibility beyond what is needed to read old tracker artifacts that only contain `commands`.
- Do not rely on direct Logseq database state inspection to infer whether a command has been applied.

## Proposed State Model

Add execution progress to `LogseqReversibleTransactionTracker`:

```ts
private executedCommandCount = 0;
private readonly debouncedRevert: DebouncedFunc<() => void>;
private activeOperation: Promise<unknown> = Promise.resolve();
```

Semantics:

- `executedCommandCount` means commands at indexes `< executedCommandCount` are currently applied in Logseq.
- Commands at indexes `>= executedCommandCount` are queued but not yet applied.
- Adding a new command appends it without changing `executedCommandCount`.
- A fully reverted tracker has `executedCommandCount === 0`.
- A fully executed tracker has `executedCommandCount === commandQueue.length`.
- A cleared tracker has no commands and `executedCommandCount === 0`.

The tracker should expose minimal introspection methods:

```ts
public getExecutedCommandCount(): number;
public hasPendingCommands(): boolean;
public hasAppliedCommands(): boolean;
```

## Execute Behavior

Change `execute()` so it only applies remaining commands:

1. Cancel any scheduled revert before executing.
2. Start at `executedCommandCount`, not index `0`.
3. Execute commands in order from `executedCommandCount` to the end.
4. After each command succeeds, increment `executedCommandCount` immediately.
5. Accumulate `changedPages` for newly executed commands.
6. Return the last newly executed command result.
7. If there are no remaining commands, return `null` or the last known result only if a concrete caller needs it.

Failure handling:

1. If a command fails after some new commands were applied, revert only the commands applied during that failed `execute()` call.
2. Decrement `executedCommandCount` after each successful rollback.
3. Leave commands applied before this `execute()` call untouched.
4. Re-throw the original error.

This avoids undoing earlier preview state when a newly appended command fails.

## Revert Behavior

Change `revert()` so it only reverts currently applied commands:

1. Cancel any scheduled revert before explicit revert starts.
2. Iterate indexes `executedCommandCount - 1` down to `0`.
3. After each command successfully reverts, decrement `executedCommandCount`.
4. Stop when `executedCommandCount === 0`.

Failure handling:

- If a revert command fails, leave `executedCommandCount` pointing at the first command that is still considered applied.
- Surface the error to the caller.
- Do not blindly continue reverting earlier commands, because the graph may now be in an unknown partially reverted state.

## Scheduled Revert

Add a new method:

```ts
public scheduleRevert(options?: {delayMs?: number}): void;
```

Behavior:

- Use lodash debounce instead of a hand-rolled timeout implementation.
- Add `lodash` debounce import from the existing dependency if available, or add the smallest required lodash package if not already present.
- Debounce calls by invoking the same debounced revert function each time.
- Default delay should be conservative, for example `1500ms` to `3000ms`.
- When the debounced function fires, call `revert()` once.
- If `execute()` or explicit `revert()` is called before the debounced function fires, call `debouncedRevert.cancel()`.
- Log scheduled revert failures with the centralized logger instead of `console.log()`.

Rationale:

- Tool calls can preview changes without immediately thrashing Logseq with execute/revert pairs.
- Multiple consecutive tool calls will keep the current preview applied, execute only the newly appended commands, and push the cleanup later.
- If the assistant continues editing, the preview state remains stable and cumulative.
- If the assistant stops before commit review, the scheduled revert cleans up the preview.

## Operation Serialization

Guard tracker operations so `execute()`, `revert()`, and scheduled revert cannot overlap.

Add an internal operation queue, for example:

```ts
private enqueueOperation<T>(operation: () => Promise<T>): Promise<T>;
```

All mutating tracker operations should run through it.

This prevents cases where a scheduled revert fires while a tool call is executing the next command.

## Serialization Changes

Update `LogseqReversibleTransactionTrackerSerializer` to persist progress:

```ts
{
    commands: LogseqReversibleCommand[];
    executedCommandCount?: number;
}
```

Decode behavior:

- Missing `executedCommandCount` means old artifact; default to `0`.
- Clamp invalid values to the command count or reject them with Zod validation. Prefer validation unless old artifacts are expected to be malformed.

Encode behavior:

- Always include `executedCommandCount`.

Important limitation:

- Debounce runtime state must not be serialized. Only command progress should persist in artifacts.

## Tool Flow Changes

For mutation tools such as update block, insert block, move block, create page, delete page, and rename page:

Current flow:

```ts
transactionTracker.addCommand(command);
await transactionTracker.execute();
await transactionTracker.revert();
```

New flow:

```ts
transactionTracker.addCommand(command);
await transactionTracker.execute();
transactionTracker.scheduleRevert();
```

Effect:

- The first mutation applies the preview.
- Later mutations execute only newly added commands.
- Revert is delayed and debounced instead of immediate.
- The serialized artifact records how many commands are currently applied.

Read-only tools should not schedule revert unless they intentionally depend on pending preview state. Review each read-only command separately.

## Commit Review Flow

Change `LogseqCommitChangesTool.prepareReview()`.

Current flow:

```ts
await transactionTracker.execute();
const changedPages = transactionTracker.getChangedPages();
const afterChanges = await LogseqPageDataPrinter.print(changedPages);
await transactionTracker.revert();
const beforeChanges = await LogseqPageDataPrinter.print(changedPages);
```

New flow:

1. Cancel any scheduled revert by calling `execute()`.
2. Execute only remaining commands.
3. Capture `changedPages`.
4. Capture `afterChanges` while preview is still applied.
5. Revert once to capture `beforeChanges`.
6. Return both states.

This still needs one revert to produce the before/after diff, but avoids replaying commands that are already applied and avoids repeated per-tool execute/revert cycles.

Alternative if UX allows:

- Capture `beforeChanges` before executing the preview and `afterChanges` after executing it.
- Keep the preview applied while the modal is open.
- On approve, clear the tracker without re-executing.
- On reject or modal close, call `scheduleRevert()` or explicit `revert()`.

This alternative is safer because approval does not need another write pass. It may require changing modal behavior so the graph remains previewed during review.

## Commit Approval Flow

Change `executeApprove()` so it respects progress:

1. Load the latest tracker artifact.
2. If no commands exist, return no-op success.
3. Call `execute()` to apply only remaining commands.
4. Treat the currently applied preview as the committed state.
5. Call `clear()` to forget commands and reset progress without reverting.
6. Serialize the empty tracker artifact.

This means if review left the preview applied, approval does not write anything again. If review reverted before approval, approval applies the pending commands once.

## Clear And Cancel Semantics

`clear()` should:

- Cancel scheduled revert.
- Clear command queue.
- Clear changed pages.
- Reset `executedCommandCount` to `0`.

Cancel/reject behavior should be explicit:

- If the user rejects a commit while preview is applied, call `revert()` or `scheduleRevert()` depending on whether immediate cleanup is required.
- If the user closes the review modal without a decision, prefer `scheduleRevert()` so preview state is cleaned up without racing the UI.

## Logging

- Remove the direct `console.log()` in `LogseqCommitChangesTool.prepareReview()`.
- Use the centralized logger from `src/logger` for scheduled revert failures or debug information.
- Add a logger category only if an existing relevant category does not already exist.

## Tests

Add unit tests for `LogseqReversibleTransactionTracker` with fake reversible commands:

- `execute()` applies all commands on first call.
- Second `execute()` with no new commands does not re-execute already applied commands.
- Adding a command after execution causes only the new command to execute.
- `revert()` reverts only applied commands.
- `revert()` updates `executedCommandCount` as each command reverts.
- Failed incremental execute rolls back only commands applied during that call.
- `clear()` resets commands, changed pages, progress, and scheduled revert.
- Serializer round-trips `executedCommandCount`.
- Serializer reads old artifacts without `executedCommandCount` as `0`.
- `scheduleRevert()` debounces multiple calls into one revert.
- `execute()` cancels a pending scheduled revert.
- lodash debounce cancellation is used when clearing, executing, or explicitly reverting.

Update existing serializer tests to include the new field.

For Logseq integration tests:

- Existing skipped Logseq tests can be extended, but they should remain compatible with the `shouldRunTests()` gate.
- Add or adapt a test that executes, serializes, deserializes, adds another command, and verifies only the new command runs.

## Verification

After implementation:

1. Run focused tracker tests:

```sh
pnpm test LogseqReversibleTransactionTracker --run
```

2. Run serializer tests:

```sh
pnpm test LogseqReversibleTransactionSerializer --run
```

3. Run type check:

```sh
npx tsc --noEmit
```

4. Run Biome checks on modified files:

```sh
npm run check <modified-file>
npm run check:fix <modified-file>
```

5. Manually test in Logseq:

- Ask AI to make one block update.
- Ask AI to make another block update.
- Confirm the second tool call does not replay the first command.
- Open commit review.
- Approve and verify the final graph has one copy of every intended change.
- Reject or close review and verify preview changes are reverted once.

## Implementation Order

1. Add tracker progress state and introspection methods.
2. Change `execute()`, `revert()`, and `clear()` to maintain progress.
3. Add operation serialization to prevent overlapping mutations.
4. Add `scheduleRevert()` and scheduled revert cancellation.
5. Update serializer schema, encode, decode, and tests.
6. Update mutation tools to use `execute()` plus `scheduleRevert()` instead of immediate `revert()`.
7. Update commit review and approval flow.
8. Replace direct console logging with centralized logger.
9. Run focused tests, type check, Biome checks, and manual Logseq verification.

## Open Questions

- Should commit review keep the preview applied while the modal is open, or should it still revert before showing the modal?
- What default debounce delay best matches Logseq commit latency on large graphs?
- Should scheduled revert be disabled once the commit review modal is open?
- Should read-only commands be included in the reversible tracker at all, or should only graph-mutating commands participate in progress tracking?
