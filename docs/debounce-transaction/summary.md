# Debounced Reversible Transactions: Requirements And Decisions

## Purpose

This document records the agreed requirements, the final design, important examples, and the alternatives considered during planning. It is the design authority for the three implementation plans in this directory.

The implementation plans are:

- [Part 1: Command And Tool Changes](./part-1-command-and-tool-changes.md)
- [Part 2: React Chat Lifecycle Changes](./part-2-react-chat-lifecycle.md)
- [Part 3: Transaction Tracker Changes](./part-3-transaction-tracker.md)

## Current Problem

Most Logseq editing tools currently follow this sequence:

```ts
const tracker = getLastLogseqReversibleTransactionTracker(messages);
tracker.addCommand(command);
const result = await tracker.execute();
await tracker.revert();
return createArtifact(tracker, result);
```

Immediate reversion was part of the original preview design. It guaranteed that command execution state only had to live in memory for a very short time.

The design now has several problems:

- Consecutive tools repeatedly apply and revert the same command queue.
- Repeated Logseq writes can unnecessarily stress the database.
- `execute()` currently starts from the first command every time.
- `revert()` currently attempts to revert every command every time.
- Command rollback data such as original content and original block position is not serialized.
- A tracker deserialized after an applied preview cannot currently revert commands that depend on runtime-only rollback fields.
- Multiple tracker instances from different threads can execute or revert concurrently.
- There is no React lifecycle owner for timeout, thread navigation, recovery, or countdown UI.

## Final Design At A Glance

The final design is:

1. Mutation tools apply temporary Logseq changes and return an applied tracker artifact without immediately reverting it.
2. `useLogseqReversibleTransactionLifecycle` observes the branch-local artifact and schedules a trailing-edge revert after 10 seconds.
3. Every new completed execution resets the 10-second deadline.
4. The Composer displays the remaining time.
5. The tracker records the applied command prefix using `appliedCommandCount`.
6. Every command serializes a command-owned `commandState` containing `status` and any state needed for execution or reversion.
7. `execute()` and `revertImmediately()` serialize all plugin tracker operations through one static global mutex.
8. Thread and message-branch navigation revert the outgoing branch before navigation completes.
9. Loading a branch with an applied tracker immediately reverts it and updates that exact message artifact.
10. Commit review cancels the timeout, executes as needed, captures the after state, immediately reverts, and captures the before state.

## Functional Requirements

### Delayed Reversion

- The default revert delay is 10 seconds.
- Reversion uses trailing-edge debounce behavior.
- Every completed tracker execution resets the deadline to 10 seconds.
- Only an applied graph mutation starts the countdown.
- Read-only commands do not independently start a countdown.
- When the timeout fires, the current tracker is reverted once and its message artifact is updated.

### Immediate Reversion

- Add `revertImmediately()` as the explicit immediate graph operation.
- Remove or replace the old ambiguous public `revert()` API.
- `revertImmediately()` must not contain debounce logic.
- Commit review, clear changes, thread navigation, branch navigation, and load recovery use immediate reversion.

### Incremental Execution

- `execute()` starts at the first unapplied command.
- Previously applied commands are not executed again unless the tracker was reverted first.
- Appending one command to an applied tracker executes only that new command.
- A fully reverted tracker can execute the complete queue again.
- A failed incremental execute rolls back only commands newly applied by that execute call.

### Global Operation Serialization

- All tracker instances and all chat threads share one mutex.
- The existing `await-lock` dependency is used.
- The lock is acquired inside `execute()` and `revertImmediately()`.
- One lock acquisition covers the complete execute or reverse command loop.
- Progress and command status used by an operation are read only after acquiring the lock.
- The lock serializes this plugin's operations only.

### Persisted Command State

- Every command has one explicit Zod command-state schema.
- Every command state contains `status: "new" | "executed"`.
- Command state includes all JSON-compatible command-owned values needed for later execution or reversion.
- Generated stable identifiers move into command state.
- Runtime rollback snapshots move into command state.
- A command may retain state after reversion when useful for re-execution.
- Commands use `status` for lifecycle checks instead of inferring execution from optional fields.

### Branch-Local Persistence

- Tracker artifacts remain in assistant-ui tool-call messages.
- The latest artifact in the selected message branch is the source of tracker state.
- Reverting must update the exact message and tool-call artifact from which the tracker was loaded.
- Persisted repository updates must preserve all unrelated branches and messages.
- Tracker state is not stored as one thread-level value in `ThreadFileData.custom`.

### Thread And Branch Lifecycle

- Cancel the active assistant run before leaving a thread or branch.
- Cancel the pending debounce before navigation.
- Revert the outgoing branch before switching threads, creating a thread, or selecting another message branch.
- After a thread or branch loads, inspect its latest tracker artifact.
- Immediately revert a loaded tracker that still has applied graph mutations.
- Save the reverted state back to the same branch artifact.

### Composer Status

- Show a message above the Composer while delayed cleanup is scheduled.
- The expected text is similar to `Reverting temporary changes in 10s`.
- Update the displayed seconds as the deadline approaches.
- Hide the message after revert, commit, clear, or when no graph mutation is applied.
- Document the Composer customization in its existing change-history comment.

### Commit And Clear Behavior

- Commit review cancels the delayed revert before preparing a diff.
- Diff preparation uses `execute()`, captures after state, uses `revertImmediately()`, then captures before state.
- Approval reuses the same tracker instance, executes it again, and clears it without reverting.
- Rejection or modal dismissal leaves the graph reverted.
- Clear Changes first reverts applied graph mutations and then clears the tracker.

### Read-Only Commands

- `ReadBlockCommand`, `TextSearchCommand`, and `DataScriptQueryCommand` remain in the tracker.
- They remain ordered with mutations so they can observe temporary graph state.
- They must be classified as non-mutating for pending-change, countdown, and commit checks.
- Their reverse operation remains a no-op while still maintaining normal command status transitions.

## Command Serialization Model

### Common Shape

Commands use a nested serialized shape:

```ts
{
    type: "UpdateBlock",
    args: {
        blockUuid: "...",
        content: "new content"
    },
    commandState: {
        status: "executed",
        originalContent: "old content"
    }
}
```

The responsibilities are:

- `type` selects the command codec.
- `args` contains parsed model/user intent.
- `commandState` contains command-owned durable identity, lifecycle status, and rollback data.

### New Update Command Example

Before execution:

```ts
{
    type: "UpdateBlock",
    args: {
        blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
        content: "Updated content"
    },
    commandState: {
        status: "new"
    }
}
```

After execution:

```ts
{
    type: "UpdateBlock",
    args: {
        blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
        content: "Updated content"
    },
    commandState: {
        status: "executed",
        originalContent: "Original content"
    }
}
```

After immediate reversion, status returns to `new`. `originalContent` may be retained or replaced during the next execute according to the command's implementation.

### Stable Identifier Example

An insert command needs the same generated block UUID across execute, revert, serialization, and re-execution:

```ts
{
    type: "InsertBlock",
    args: {
        parentUuid: "...",
        content: "Inserted content",
        sibling: true
    },
    commandState: {
        status: "new",
        blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
    }
}
```

`blockUuid` remains in `commandState` after revert because it is needed for later re-execution.

### Rollback Snapshot Example

`DeleteBlockCommand` must serialize values that currently exist only in private runtime fields:

```ts
{
    status: "executed",
    previousBlockUuid: "...",
    isPreviousBlockParent: false,
    temporaryPageUuid: "..."
}
```

This allows an applied tracker to be serialized in one tool result and reverted later by the React lifecycle hook after deserialization.

## Codec Simplification

Each command supplies only:

```ts
createReversibleCommandCodec({
    type: "UpdateBlock",
    argsSchema: UpdateBlockCommandArgsSchema,
    commandStateSchema: UpdateBlockCommandStateSchema,
    commandClass: UpdateBlockCommand
});
```

The generic helper creates the serialized schema and generic encode/decode logic. Command files no longer manually define:

- A repeated serialized command schema.
- A separate serialized-state type.
- A custom `encodeData` function.
- Custom spreading of args and generated identifiers.

The command-state schema remains explicit. Fully automatic reflection-based serialization was rejected because it would not provide a stable, validated artifact contract.

## Tracker State Model

The tracker persists:

```ts
{
    version: 2,
    commands: [...],
    appliedCommandCount: 2,
    changedPages: ["page-uuid"]
}
```

The count defines the applied prefix:

```ts
commands.slice(0, appliedCommandCount); // applied
commands.slice(appliedCommandCount); // not applied
```

The required invariant is:

```text
index < appliedCommandCount  => commandState.status === "executed"
index >= appliedCommandCount => commandState.status === "new"
```

Both values are kept intentionally:

- The count controls ordered tracker execution and reversion.
- The status supports checks inside each command.

`changedPages` is persisted because commit review may deserialize a fully applied tracker and call `execute()` with no new commands. The tracker still needs to know which pages to print.

## Operation Examples

### Consecutive Mutation Tools

Assume the first tool adds command A:

```text
commands = [A]
appliedCommandCount = 0
```

After `execute()`:

```text
commands = [A]
appliedCommandCount = 1
A.status = executed
```

The hook schedules cleanup in 10 seconds. Before the timer fires, another tool appends command B:

```text
commands = [A, B]
appliedCommandCount = 1
```

The next `execute()` applies only B:

```text
commands = [A, B]
appliedCommandCount = 2
A.status = executed
B.status = executed
```

The hook resets the deadline to 10 seconds. When the timeout eventually fires, immediate reversion processes B and then A.

### Commit Diff

If A and B are still applied:

```text
cancel scheduled revert
execute()             -> no replay; both are already applied
capture after state
revertImmediately()  -> revert B, then A
capture before state
show review modal
```

If approved:

```text
execute() -> apply A, then B again
clear()   -> keep graph changes, remove pending command metadata
```

If rejected, no additional graph operation is required because diff preparation already reverted the tracker.

### Thread Load Recovery

If the latest branch artifact contains:

```text
appliedCommandCount = 2
```

the lifecycle hook immediately deserializes it, calls `revertImmediately()`, changes the count to zero, and updates the same tool-call artifact. It does not start another 10-second timer for this recovery operation.

## Global Lock Model

The static lock manager is intentionally small:

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

`execute()` and `revertImmediately()` call `runExclusive()` internally. Raw `acquire()` and `release()` are not exposed.

The following are not independently locked:

- `addCommand()` on a local tracker instance.
- Passive getters used by the UI.
- Countdown updates.
- Serialization after a completed operation.
- `clear()` when used after revert or as intentional commit acceptance.

There is no generic `withExclusiveOperations()` tracker facade.

## Debounce And Cancellation Model

The hook owns a lodash trailing-edge debounced callback and an abort controller for each schedule.

Canceling a schedule must cover both cases:

- The lodash callback has not fired, so normal debounce cancellation prevents it.
- The callback has fired but is waiting for the mutex, so its abort signal is checked after `revertImmediately()` acquires the lock.

This matters during commit review. A stale timeout waiting behind `execute()` must not acquire the lock afterward and revert the graph before the diff is captured.

## Considered And Rejected Alternatives

| Suggested design | Reason it was rejected | Final decision |
| --- | --- | --- |
| Store an authoritative tracker in `ThreadFileData.custom` and mirror it into messages. | A thread can contain multiple message branches with different tracker histories. One thread-level tracker would not correctly represent the selected branch. | Keep the tracker exclusively in branch-local tool-call artifacts and patch the exact artifact after revert. |
| Put debounce state and the lodash function inside `LogseqReversibleTransactionTracker`. | Tools deserialize a new tracker instance from each artifact. Old instances could retain stale timers and revert newer graph state. | Keep all debounce ownership in `useLogseqReversibleTransactionLifecycle`. |
| Make `revert()` itself debounced and add a second immediate method. | A debounced async method has misleading promise semantics, and callers cannot tell when graph cleanup actually completed. | Replace the operation with explicit `revertImmediately()`; only the hook schedules it. |
| Automatically serialize every command class field. | Runtime reflection would include implementation details and possibly non-JSON Logseq entities. It also removes Zod's explicit artifact contract. | Serialize one explicit, validated `commandState` object through a generic codec. |
| Generate restrictive `persistent` and `executed` state schemas with a shared state helper. | Commands may intentionally retain rollback or execution data after reverting for later re-execution. A forced split would be unnecessarily restrictive. | Let each command define one unrestricted command-state schema with a common `status` field. |
| Remove command status and rely only on `appliedCommandCount`. | Commands still need an explicit local lifecycle check instead of inferring state from fields such as `originalContent`. | Keep both count and command status and validate their invariant. |
| Remove read-only commands from the tracker. | Read tools need to run against currently applied temporary changes and remain ordered with those mutations. | Keep read commands but classify them as non-mutating for countdown and commit checks. |
| Add conflict fingerprints and a dedicated transaction conflict error. | This would add substantial complexity beyond the current command behavior. Existing Logseq API errors are acceptable when external edits make a revert fail. | Preserve straightforward API error propagation with no conflict framework. |
| Add a write-ahead journal and split commands into `prepare()` and `apply()` phases. | Strong recovery in the middle of one Logseq API operation is not required and would significantly expand the refactor. | Recover only from completed tool artifacts; explicitly exclude the mid-call termination window. |
| Add a generic `tracker.withExclusiveOperations()` or locked-operation facade. | It complicates a tracker whose required lock boundaries are already clear. | Use one static lock manager and acquire it directly inside `execute()` and `revertImmediately()`. |
| Hold one custom compound tracker lock across execute, diff printing, and revert. | This requires reentrant locking or unlocked internal APIs and was judged unnecessarily complex for the intended UI flow. | Cancel the hook timer, then use the normal locked `execute()` and `revertImmediately()` operations. |

## Accepted Limitations And Non-Goals

### User And External Edits

The mutex does not block direct user edits, other plugins, or Logseq activity during the temporary-change window. This is accepted. Commands retain their current validation and error behavior; no graph-wide conflict-detection system will be introduced.

### Mid-Call Termination

The implementation does not guarantee recovery if the process terminates after a Logseq mutation starts but before the updated tool artifact is emitted and persisted.

The implementation therefore does not add:

- A write-ahead transaction journal.
- An in-flight command status.
- `prepare()` and `apply()` command phases.
- Database-level transactions or checkpoints.

### No Thread-Level Tracker

No second authoritative tracker is stored outside message artifacts. The implementation must solve persistence by updating the correct branch artifact, not by bypassing branching.

### No General Transaction Framework

The change remains focused on this plugin's reversible Logseq command queue. It will not attempt to provide database isolation, prevent user edits, or replace Logseq's own transaction system.

## FAQ

### Why is command state serialized now?

There can be a meaningful delay between execute and revert. A tracker can also be serialized in one tool result and reverted later by the lifecycle hook. Runtime-only fields are therefore insufficient.

### Why are command state and tracker progress both persisted?

Tracker progress determines the ordered prefix that is applied. Command state contains the specific values required to reverse each command and gives the command an explicit lifecycle status.

### Why does the hook update the artifact after reverting?

Without the update, a later tool or thread reload would deserialize an artifact that still claims changes are applied. It could skip required execution or attempt a duplicate revert.

### Why is thread load reverted immediately instead of restarting the countdown?

The artifact may have survived a previous chat close or interruption. The design treats loaded applied changes as cleanup work, not as a new live preview.

### Why do read-only commands participate in execute and revert?

They need to observe the temporary state produced by preceding mutation commands. Their reverse operation is a no-op, but their ordering remains meaningful.

### Will commit diff generation interfere with the debounce?

The review action cancels the scheduled revert first. An abort signal also invalidates a callback that already fired but is still waiting for the mutex. The review then executes as needed, captures after state, immediately reverts, and captures before state.

### What did the original reference to "tag load" mean?

It meant thread load. Message branch changes follow the same cleanup rule because tracker ownership is branch-local.

## Completion Criteria

The design is complete when:

- Mutation tools leave an applied artifact instead of immediately reverting.
- Commands can be serialized after execution and reverted after deserialization.
- Execute and immediate revert are incremental and globally serialized.
- The hook resets and displays a 10-second revert deadline.
- Delayed revert updates the exact branch artifact.
- Thread and branch navigation clean up before switching.
- Loaded applied artifacts are immediately reverted.
- Commit review and Clear Changes use the new immediate-revert semantics.
- Read-only commands remain ordered but do not count as graph mutations.
- Legacy tracker artifacts remain readable.
- The explicitly excluded mid-call termination case remains documented and is not over-engineered.
