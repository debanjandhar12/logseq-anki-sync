# Part 2: React Chat Lifecycle Changes

## Goal

Add a lifecycle hook that owns delayed reversion, exposes countdown information to the Composer, cleans up temporary changes during navigation, and updates the exact branch-local message artifact after cleanup.

## Scope

Primary files:

- `src/chat-app/hooks/useLogseqReversibleTransactionLifecycle.ts`
- `src/chat-app/components/AppContent.tsx`
- `src/chat-app/components/Composer.tsx`
- `src/chat-app/components/ThreadList.tsx`
- `src/chat-app/components/ThreadTopToolBar.tsx`
- `src/chat-app/components/ThreadWrapper.tsx`
- Branch-picker components used by the chat app
- `src/chat-app/tools/impl/LogseqCommitChangesTool.tsx`
- `src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker.ts`
- A message-artifact persistence helper near the chat runtime/store code

The hook should be named `useLogseqReversibleTransactionLifecycle`, because it coordinates tracker lifecycle rather than merely returning a tracker.

## Hook Responsibilities

The hook should expose state and lifecycle actions similar to:

```ts
{
    hasTemporaryChanges: boolean;
    remainingSeconds: number | null;
    cancelScheduledRevert: () => void;
    revertCurrentTrackerImmediately: () => Promise<void>;
}
```

The exact public shape can follow existing project patterns, but the hook must own:

- The current branch's tracker and artifact location.
- The lodash trailing-edge debounce.
- The default 10-second delay.
- The active deadline and countdown updates.
- Timer cancellation and reset.
- Immediate cleanup during navigation.
- Immediate cleanup after loading a thread or branch.
- Persisting the updated tracker artifact.

The debounce must not be stored on `LogseqReversibleTransactionTracker`, because each tool reconstructs a new tracker object from its message artifact.

## Observing Tracker Artifacts

Extend the current tracker lookup utility so it returns both the tracker and its exact location:

```ts
{
    tracker: LogseqReversibleTransactionTracker;
    messageId: string;
    toolCallId: string;
}
```

The hook should observe the current branch's messages through `useAuiState` and identify the latest tracker artifact.

When a completed mutation tool produces a new artifact:

1. Cancel the prior debounce.
2. Replace the current tracker reference and artifact location.
3. Check whether an applied graph mutation exists.
4. Schedule a new 10-second trailing-edge revert.
5. Update the countdown state.

Read-only tracker changes must not start a countdown when no graph mutation is applied.

The initial thread/branch load path must be distinguished from ordinary message updates. A loaded applied artifact is reverted immediately, not scheduled for ten seconds.

## Debounce Cancellation

Each scheduled callback should have an abort mechanism. Canceling the timer must also invalidate a callback that has already fired but is waiting for the global transaction mutex.

The callback should call `revertImmediately({signal})`. `revertImmediately()` checks the signal after acquiring the lock. This prevents a canceled commit-review timer from reverting after review has started.

The hook should cancel the timer when:

- A new tracker artifact is observed.
- The user starts thread or branch navigation.
- Commit review begins.
- The current component unmounts.
- The tracker has no applied graph mutations.

## Composer Message

Update `src/chat-app/components/Composer.tsx` to display a compact status message above the composer shell when temporary graph mutations are applied and a revert is scheduled:

```text
Reverting temporary changes in 10s
```

Use the hook's `remainingSeconds` value and round up to avoid displaying `0s` before the callback fires.

The existing Composer change-history comment must receive a new entry documenting this project-specific status message.

The status should disappear when:

- The tracker is reverted.
- The user commits the changes.
- The tracker is cleared.
- No graph-mutating command is applied.

## Message Artifact Persistence

After a delayed or immediate revert, patch the exact tracker artifact instead of replacing a generic "last artifact."

The persistence helper should:

1. Export the active assistant-ui thread repository.
2. Locate the exact message ID and tool-call ID.
3. Replace only that tool-call's tracker artifact.
4. Import the patched repository back into assistant-ui.
5. Load the latest persisted thread data from `ThreadStore`.
6. Apply the same exact message-part patch while preserving all branches.
7. Save the updated thread data.

Do not place the tracker in `ThreadFileData.custom`. The tracker remains branch-local because different message branches can have different tracker histories.

The helper should merge against freshly loaded persisted data before saving so a concurrent message append does not cause an unrelated branch or message to be overwritten.

## Thread Navigation

Before switching threads:

1. Call `api.thread().cancelRun()`.
2. Cancel the pending debounce.
3. Load the outgoing branch's latest tracker.
4. Call `revertImmediately()` if graph mutations are applied.
5. Patch and persist the reverted artifact.
6. Proceed with `switchToThread()` or `switchToNewThread()`.

Use explicit assistant-ui thread APIs after cleanup rather than relying only on the default primitive trigger behavior. This allows navigation to wait for cleanup.

The toolbar's new-thread action and the custom thread-list item trigger both need this guard.

## Thread And Branch Load

After a thread or branch finishes loading:

1. Locate its latest tracker artifact.
2. If it has applied graph mutations, call `revertImmediately()` immediately.
3. Patch and persist the artifact with the reverted state.
4. Do not schedule a delayed revert for this recovery pass.

This handles the case where the chat was closed while a completed tool artifact still described applied temporary changes.

Message branch changes must use the same cleanup behavior as thread changes. Otherwise a branch switch could leave one branch's temporary graph state applied while another branch becomes active.

## Commit Integration

Expose `cancelScheduledRevert()` through a chat-app lifecycle context so `LogseqCommitChangesTool` can cancel the hook timer before generating a diff.

Review flow:

1. Cancel the debounce.
2. Execute pending commands.
3. Capture the after snapshot.
4. Revert immediately.
5. Capture the before snapshot.
6. Persist the reverted tracker artifact.
7. Display the modal.

Approval reuses the same tracker object, executes it again, and clears it without reverting. No new debounce is scheduled during review or after successful commit.

## Cancellation

Use assistant-ui's `api.thread().cancelRun()` during navigation. Tool execution should also check the supplied abort signal before starting additional commands.

Do not add a larger execution scheduler or attempt to forcibly interrupt an already-running Logseq API call. The global mutex and abort check are sufficient for the intended behavior.

## Tests

Add tests for:

- Initial loaded applied artifact being reverted immediately.
- New completed mutation artifact scheduling a 10-second revert.
- A new artifact resetting the countdown.
- Read-only artifacts not displaying a pending graph-change countdown.
- Timer cancellation invalidating a callback waiting for the mutex.
- Composer status text and countdown rounding.
- Exact message/tool-call artifact replacement.
- Preserving unrelated message branches during artifact persistence.
- Thread switch cleanup before assistant-ui navigation.
- New-thread cleanup.
- Branch switch cleanup.
- Commit review canceling the debounce.
- Commit rejection leaving the tracker reverted.
- Commit approval reusing the same tracker and clearing it.

## Acceptance Criteria

- Temporary changes are automatically reverted after ten seconds when the chat is idle.
- The Composer visibly communicates the pending revert.
- Switching threads or branches never leaves the outgoing branch's completed temporary changes applied.
- Loading a thread or branch immediately cleans up previously applied temporary changes.
- Reverted tracker state is persisted to the correct message branch.
- Commit review and approval do not race the debounce.
