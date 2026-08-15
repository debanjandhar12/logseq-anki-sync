---
title: Stop Tool-Result Race
---

# Stop Tool-Result Race

## Summary

The Stop button terminates an assistant turn by adding an error result to every unresolved tool call:

```json
{
  "success": false,
  "error": "User terminated the operation"
}
```

The assistant message is also changed to:

```ts
{type: "incomplete", reason: "cancelled"}
```

Initially, the result appeared correctly in the UI and storage. However, after the user continued the conversation, the result could disappear. A later model request would then fail with an error such as:

```text
Tool results are missing for tool calls call_00_..., call_01_...
```

Two independent concurrency problems contributed to this behavior:

1. Multiple storage writers could overwrite each other's complete thread snapshots.
2. More importantly, an assistant-ui run could still be active after its message status changed to `requires-action`. A late yield from that run replaced the stopped message with stale content that did not contain the synthetic results.

Storage synchronization was necessary to prevent lost durable updates, but it was not sufficient to stop the live assistant-ui runtime from producing a newer stale update.

## Relevant Components

The behavior crosses several modules:

- `src/chat-app/runtime/thread-run/stopThreadRun.ts`
  - Cancels active runs.
  - Adds terminal results to unresolved tool calls.
  - Imports the terminal repository into assistant-ui.
  - Persists the terminal state.
- `src/chat-app/runtime/thread-run/terminateToolTurn.ts`
  - Performs the pure repository transformation.
- `src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter.ts`
  - Streams model content and executes frontend tools.
- `src/chat-app/runtime/withRoundtripPersistence.ts`
  - Persists non-terminal assistant messages after an adapter roundtrip.
- `src/chat-app/runtime/LocalThreadHistoryAdapter.ts`
  - Loads and appends persisted messages.
- `src/core/stores/thread-store/ThreadStore.ts`
  - Reads and writes complete thread files.
- `src/chat-app/runtime/thread-run/ThreadRunTracker.ts`
  - Tracks whether the project's chat adapter is actually still running.

## What the AI SDK Requires

For every non-provider-executed tool call, model history must contain both:

1. An assistant `tool-call` part.
2. A corresponding tool `tool-result` part with the same tool-call ID.

The project's message conversion behaves correctly when a stopped tool result is present. A stopped assistant-ui tool part is converted to an AI SDK `output-error`, which the AI SDK converts into a matching tool-result message.

The reported error therefore did not originate in message conversion. It meant that the tool result had already disappeared from the assistant-ui message repository before conversion.

## Storage Lost-Update Race

### Previous behavior

Several code paths independently performed complete thread read/modify/write operations:

```text
load thread file
modify one field or message
save the complete thread file
```

These paths included:

- Normal history appends.
- Stop-state persistence.
- Thread title and archive metadata updates.
- Reversible transaction artifact persistence.

The operations were not coordinated. Two writers could load the same old thread and save different modified snapshots.

### Example

Assume storage contains an unresolved assistant tool call:

```text
S0 = assistant tool call without a result
```

The following ordering was possible:

```text
Stop loads S0
Continuation append loads S0
Stop saves S0 + termination result
Continuation saves S0 + user continuation
```

The continuation save was based on a stale snapshot, so it removed the result written by Stop.

### Synchronization fix

`ThreadStore` now provides a serialized per-thread update operation using `async-lock` keyed by
thread ID. The lock covers the complete transaction:

```text
acquire per-thread lock
read the latest thread
apply the requested transformation
write the resulting thread
release the lock
```

Locking only the final write would not be enough. Both callers could still read the same old state before taking the write lock. The read and transformation must be inside the same critical section as the write.

Different thread IDs can still update concurrently. Only mutations of the same thread are serialized.

All current thread mutation paths use this update boundary so that metadata and artifact writes
cannot accidentally restore an older message repository. Missing-file behavior is normalized by
`LogseqPluginStorageManager`: every backend returns `undefined` for a missing file, including the
Logseq sandbox backend that otherwise throws `"file not existed"`.

### Why synchronization was necessary

Even after fixing the main assistant-ui lifecycle problem described below, unsynchronized storage writers could still remove a valid result after it had been produced correctly. The synchronization change protects durable thread history from independent lost updates.

### Why synchronization was insufficient

The lock orders storage writes, but it cannot determine whether a later write is logically stale.

If assistant-ui produces a new message update after Stop, `ThreadStore` correctly serializes it after the Stop write. Without fixing the runtime lifecycle, the stale assistant-ui update still wins because it is the later operation.

## Actual Live-Runtime Root Cause

### Previous intermediate `requires-action` status

The earlier `LocalAISDKChatModelAdapter` yielded a tool call as soon as it arrived:

```ts
yield {
    content,
    status: {type: "requires-action", reason: "tool-calls"}
};
```

The final form of this status is needed so assistant-ui can decide whether another model roundtrip should run. It is no longer emitted while automatic tool execution is active.

However, the adapter generator may still be active after this yield. It can still be:

- Reading the model stream.
- Collecting more tool calls.
- Awaiting frontend tool execution.
- Producing tool results.
- Producing final usage and status metadata.

The message is therefore visibly `requires-action` even though the underlying run has not ended.

### Incorrect public `isRunning` state

For LocalRuntime, assistant-ui derives public `isRunning` from the last assistant message status when the runtime core does not expose a separate run state:

```ts
lastMessage.status.type === "running"
```

As soon as the adapter yields `requires-action`, public `isRunning` becomes `false`.

This does not mean that assistant-ui's `_runLoop` or `performRoundtrip` has completed. It only reflects the latest message status.

### Stop misclassified the active run

The original Stop implementation used public `runtime.getState().isRunning` to decide whether cancellation was necessary:

```ts
if (runtime.getState().isRunning) {
    runtime.cancelRun();
    await runEnd;
}
```

During frontend tool execution, the message could be `requires-action` and `isRunning` could therefore be false. Stop treated it as a settled human-tool action:

1. It did not call `cancelRun()`.
2. It did not wait for `runEnd`.
3. It imported the terminal tool results.
4. It persisted the terminal repository.
5. It returned successfully while the old run was still active.

### assistant-ui's stale roundtrip closure

assistant-ui's LocalRuntime captures the assistant message at the start of `performRoundtrip`.

Each later adapter yield reconstructs the message from that captured state and writes it with `repository.addOrUpdateMessage()`.

Calling `runtime.import()` replaces repository state, but it does not update or invalidate the message object held by the already-running `performRoundtrip` closure.

The destructive sequence was therefore:

```text
adapter yields unresolved tool calls
message becomes requires-action
public isRunning becomes false
user clicks Stop
Stop imports synthetic error results
Stop persists synthetic error results
old frontend tool promise resolves
old adapter generator yields again
assistant-ui rebuilds the message from its stale closure
repository.addOrUpdateMessage replaces the stopped message
synthetic results disappear
```

`withRoundtripPersistence` could then persist that stale message. The per-thread lock serialized this operation correctly, but the stale message was still the later update.

## Final Lifecycle Fix

### Current frontend-tool lifecycle

The custom LocalRuntime adapter now follows assistant-ui's execution status semantics while
retaining the final LocalRuntime continuation handshake:

1. Project-managed frontend tool calls remain `running` while they are queued or executing.
2. Calls execute strictly in model-emitted order. A later executor cannot start until the previous
   result has been yielded into the assistant message.
3. Tool timing is recorded on the part only while its executor is active.
4. After automatic calls settle, the adapter yields `requires-action/tool-calls` once. LocalRuntime
   immediately starts the next model roundtrip when all automatic results exist, or pauses when a
   declared human tool is unresolved.
5. A human tool establishes an action boundary. Later project-managed automatic calls are not
   executed and receive a defined blocked result.
6. Cancellation ends the adapter step as `incomplete/cancelled`; it does not produce a continuation
   status or start later tools.

Provider-executed tools remain owned by the provider stream and do not enter this project-managed
sequential pipeline. LocalRuntime remains intentional because the chat requires branch-aware thread
state that the AI SDK ExternalStoreRuntime path does not provide.

### Explicit adapter-run tracking

The project now tracks actual adapter execution independently from assistant message status.

`ThreadRunTracker` maintains an active-run count by thread ID. `withRoundtripPersistence` registers the run when its generator begins and unregisters it in `finally`:

```ts
const endRun = trackThreadRun(threadId);
try {
    yield* chatModel.run(options);
    // Roundtrip persistence
} finally {
    endRun();
}
```

This signal remains active while the generator is waiting for a frontend tool, even if the visible message status is `requires-action`.

### Lifecycle-aware Stop behavior

Stop now considers either signal:

```ts
const hadTrackedRun = isThreadRunActive(threadId);
const wasRunning = hadTrackedRun || runtime.getState().isRunning;
```

If the adapter run is active, Stop:

1. Subscribes to `runEnd` before cancellation.
2. Rechecks the lifecycle tracker to close the event race.
3. Calls `runtime.cancelRun()`.
4. Waits until assistant-ui emits `runEnd`.
5. Only then imports and persists the synthetic terminal results.

Waiting for `runEnd` is important because assistant-ui performs its normal terminal history append before emitting that event. The synthetic result is therefore applied after the old run and its final persistence have settled.

For a genuinely settled human-tool `requires-action` message, no tracked adapter run exists. Stop does not wait for a `runEnd` event that will never occur and directly terminates the pending tool call.

### Frontend tools that ignore cancellation

Passing an `AbortSignal` to a tool does not guarantee that the tool observes it. A tool could ignore cancellation and leave its promise pending indefinitely.

Frontend tool execution now races the tool promise against the abort signal. When Stop aborts the run, the adapter settles promptly even if the underlying tool promise does not:

```text
tool promise                         abort signal
     |                                   |
     +--------------- race --------------+
                       |
                 first result wins
```

This lets assistant-ui leave `performRoundtrip`, perform its terminal cleanup, and emit `runEnd` without waiting indefinitely for uncooperative tool code.

## Stop-State Persistence and Merge Behavior

Once the active run has ended, Stop still needs to reconcile live and durable history safely.

The persistence transformation follows these rules:

- Restore a missing target parent chain from the runtime repository in parent-before-child order.
- Apply termination to the latest stored target, so stored successful results remain authoritative.
- Preserve a valid stored `headId`, including when storage has switched to an unrelated branch.
- Use the stopped target as `headId` only for an empty or invalid stored repository.
- Restore only the stopped target's ancestry, not unrelated inactive runtime branches.
- Create a missing thread record from the stopped target ancestry if initialization has not completed.

This intentionally avoids a field-level three-way merge. It addresses storage lag and branch-switch
races without replacing the complete latest repository with a stale runtime export.

## Thread Switching

assistant-ui keeps the previous thread runtime alive when the user switches threads. This is safe:
run tracking, history persistence, stop single-flight coordination, and storage locks are all keyed
by thread ID. Background runs therefore settle independently without writing into the newly active
thread.

## Why the Error Appeared Later

The disappearance did not immediately throw an error. The UI could continue to display the conversation until another model request was assembled.

During conversion, the old assistant message still contained its tool calls but no longer contained corresponding results. The AI SDK detected the invalid sequence when it encountered a later user message and threw `MissingToolResultsError`.

This is why successful later tool calls appeared related to the failure. They did not necessarily remove the old result themselves; they triggered another model request that validated the already-corrupted history.

## Regression Coverage

The tests cover:

- Stopping a normal active run.
- Stopping a tracked run while public state says `requires-action`.
- Settled human-tool required actions without waiting for `runEnd`.
- Continuation persistence before and after termination persistence.
- Missing stored repositories and missing thread records.
- Missing message ancestors.
- Stored branch switches.
- Preservation of newer successful tool results.
- Avoiding restoration of unrelated runtime branches.
- Per-thread storage transaction ordering and lock cleanup.
- Logseq storage backends that throw `"file not existed"` for absent files.
- Frontend tools that ignore cancellation.

## Key Lessons

### Message status and run lifecycle are different concepts

`requires-action` describes what the message needs next. It does not prove that the adapter generator or runtime loop has ended.

### Importing runtime state does not cancel existing producers

Replacing a repository while an old async producer can still write to it is unsafe unless the producer is cancelled, invalidated, or revision-checked.

### Serialization prevents lost updates, not stale updates

A lock guarantees ordering and atomicity. It does not make a logically stale later update correct. Both storage synchronization and producer lifecycle control were required.

### Terminal state should be applied after old producers settle

The stopped tool result is durable only when no older run closure can subsequently replace the message.
