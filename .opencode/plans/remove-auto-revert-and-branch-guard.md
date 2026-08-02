# Plan: Remove auto-revert scheduling, add branch-switch guard & "Clear pending changes"

## 1. User Requirement (verbatim)

> The useLogseqReversibleTransactionLifecycle.ts was introduced in git commit 14f4c71d. It added scheduling to revert automatically. However, it is buggy and several concerns remain. Hence, we will completely remove / simplify the auto revert logic. Additionally, minor changes are required for tracker as well.
>
> What I am thinking:
> - Thread switching should not revert changes made by the tracker.
> - No scheduling of auto revert. (remove the ui message / remove scheduling parts from hook).
> - LogseqClearChanges / LogseqCommitChanges tools should remain. The transaction tracker storage should be done inside messages as we are doing it currently.
> - During LogseqClearChanges, if an error occurs during revert, we should clear the logseq tracker and show ui message (+ log). Additionally, addResult should reflect same.
> - During LogseqCommitChanges, if an error occurs during revert (when generating diffs), we will clear the logseq tracker and show ui message (+ log). Message should be meaningful like "Failed to generate diff as revert failed due to:<error>". Additionally, addResult should trigger immediately and reflect same.
> - We should not store commands (such as ReadBlockCommand) that does not mutate graph in the tracker.
> - During execution of other logseq tools such as create page (inside LogseqReversibleTransactionTracker.execute), if an error occurs during execution, we start reverting all the changes (ignoring any revert failure mid step). Instead, we should just remove that command from the tracker so re-execution does not happen and throw the error so addResult knows why it failed.
>
> Additionally, we need to handle thread branching properly (not thread switching) (first investigate assistant ui on how to implement this):
> (a) When switching branch, if the current branch has uncommited changes, we need to revert them after confirming via showConfirmModal method. Basically, we need to show a message like: "The current branch has uncommited changes. Do you want to revert and switch branch?". If user rejects, then we will not branch. If user accepts, we will call revert and persist the tracker. We will not clear the commands.
> (b) There are three ways of branching... (1) using edit message + update button (creates new branch), (2) Refresh of AssistantMessage and (3) BranchPicker in UserMessage (creates new branch)
> (c) The showConfirmModal should show only if there are mutable changes and they are uncommited!
>
> Additionally, we need to introduce a new "Clear pending changes" button in PendingLogseqChangesDisplay popup [visible if there are uncommited changes that mutates graph in current branch]. Clicking it will stop the current chat run (if it was running) and instead append a new LogseqClearChanges tool call (ensure that the tool executes as well). Note: We will not resume the run. Also, if there were any requires-action, cancel them with User canceled operation or smth.
>
> Notes:
> Partial side effects from command execute failure handling is not required. They are the individual command's responsibility.

## 2. Final Requirement After Discussion With User

### 2.1 Clarification Q&A

| Question | Answer |
|---|---|
| Branch guard: revert fails after user confirms? | Log + show UI error; do NOT clear tracker; keep the applied count at the point revert stopped and persist it. Use a separate/strict revert method; rename `revertImmediately`. |
| ClearChanges tool result when revert fails? | Success-with-warning (`success: true` + warning note that revert failed but tracker was cleared). |
| Non-mutating commands (ReadBlock/DataScriptQuery/TextSearch)? | Execute directly (no tracker), no tracker artifact on the tool result. |
| PendingLogseqChangesDisplay tooltip vs button? | Convert to a click-open Popover (existing `src/shadcn/radix-ui/popover`). |
| Clear button visibility? | Same condition as the icon (`getGraphMutationCommandCount() > 0`); button always visible inside the popover. |

### 2.2 Final Summarized Requirements

Delete the auto-revert lifecycle hook + context + countdown UI entirely (no revert on thread switch, no scheduling). Rework tracker semantics: strict stop-at-failure revert (renamed from `revertImmediately`), no rollback-on-execute-failure (only remove the failing command and rethrow). Keep message-embedded tracker artifact storage. Non-mutating commands never enter the tracker. Guard the 3 branch-creation/switch interactions (edit+Update, assistant Refresh, user BranchPicker) with a confirm-and-revert flow shown only when applied graph mutations exist. Add a "Clear pending changes" popover action that cancels the run, cancels pending requires-action tool calls with "User canceled operation", and appends an already-executed `logseq_clear_changes` tool call without resuming the run.

## 3. Solution

### 3.1 Core tracker (`src/core/logseq-reversible-transaction-tracker/`)

**`LogseqReversibleTransactionTracker.ts`**
- Rename `revertImmediately(options?)` → **`revertAppliedCommands(options?)`** with strict semantics: revert LIFO; on the **first** revert failure, **stop**, keep `appliedCommandCount` at the number of commands still applied (failed one + everything before it), and rethrow the failure error. (No more AggregateError / continue-past-failures.)
- `execute(options?)` failure handling: remove the rollback loop. On command execute failure: remove **only the failing command** from the queue (already-applied commands stay applied; their `changedPages` contributions are kept), then rethrow the original error wrapped in a new **`LogseqReversibleTransactionExecutionError`** (carries `tracker` + `cause`) so callers can attach an up-to-date artifact.
- `LogseqReversibleTransactionCommandQueue`: add `removeAt(index: number)`.

**No guard inside `tracker.addCommand`** for non-mutating commands — the serializer decode path must still accept old persisted trackers containing ReadBlock/Query commands.

### 3.2 Transaction helpers (`src/chat-app/tools/transaction/`)

- `addAndExecLogseqReversibleCommand.ts`: add a dev-time assertion/throw if `!command.doesGraphMutations()` (mutating tools only path now).
- New `execLogseqReadOnlyCommand.ts`: runs a non-mutating command directly under `LogseqReversibleTransactionOperationLockManager.runExclusive` with abort-signal check; returns the result only (no tracker).
- New tiny helper `getTrackerArtifactFromError(err)`: returns `createLogseqReversibleTransactionTrackerArtifact(err.tracker)` when `err instanceof LogseqReversibleTransactionExecutionError`, else `undefined`.

### 3.3 Tools (`src/chat-app/tools/impl/`)

- **LogseqReadBlockTool / LogseqDataScriptQueryTool / LogseqTextSearchTool**: switch to `execLogseqReadOnlyCommand`; drop tracker artifact from responses.
- **All ~15 mutating tools** (CreatePage, InsertBlock, UpdateBlock, MoveBlock, DeletePage, RenamePage, RestorePage, CreateTagPage, property/tag tools, ...): one-line catch change — `ChatToolResponse.error(msg, getTrackerArtifactFromError(err))` so the tracker state (failed command removed, applied count) persists into the message on failure.
- **LogseqClearChangesTool**: on `revertAppliedCommands()` failure → log + `logseq.UI.showMsg` (error), `tracker.clear()`, return `ChatToolResponse.success({warning: "Failed to revert pending Logseq changes: <err>. Staged changes were cleared."}, clearedTrackerArtifact)`.
- **LogseqCommitChangesTool**:
  - Remove `cancelScheduledRevert` usage; replace `persistTrackerArtifact` from context with the new hook (3.4).
  - `prepareReview`: on revert failure while generating diffs, throw a typed marker (e.g. `DiffRevertFailedError` wrapping the cause). In `reviewAndApply` catch: `tracker.clear()`, persist artifact, log + showMsg, and immediately `addResult(ChatToolResponse.error("Failed to generate diff as revert failed due to: <error>", clearedTrackerArtifact))`.
  - Rename `revertImmediately` call → `revertAppliedCommands`.

### 3.4 Delete auto-revert lifecycle; add focused hooks (`src/chat-app/hooks/`)

**Delete:**
- `src/chat-app/hooks/useLogseqReversibleTransactionLifecycle.ts`
- `src/chat-app/context/LogseqReversibleTransactionLifecycleContext.ts`
- `tests/src/chat-app/hooks/useLogseqReversibleTransactionLifecycle.test.ts`
- `CHAT_APP_LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_REVERT_DELAY` from `src/constants.ts`

**New `usePersistLogseqTrackerArtifact.ts`:** small hook wrapping `persistLogseqReversibleTransactionTrackerArtifact` — resolves `threadId` (`remoteId ?? id` from `threadListItem`) and `ThreadRuntime` via `useAssistantRuntime().threads.getById()`. Used by CommitChangesTool render and the branch guard.

**New `useLogseqUncommittedChangesBranchGuard.ts`:** exposes `guardBranchNavigation(): Promise<boolean>`:
1. Read current messages via `aui.thread().getState().messages`; locate tracker (`findLastLogseqReversibleTransactionTracker`).
2. If no tracker or `!tracker.hasAppliedGraphMutations()` → return `true` (no modal — condition (c)).
3. `showConfirmModal("The current branch has uncommited changes. Do you want to revert and switch branch?", {confirmText: "Revert & Switch"})`. Reject → `false`.
4. Accept → `try { await tracker.revertAppliedCommands(); } catch { log + showMsg }` then **always persist** the tracker artifact (commands kept; appliedCommandCount reflects whatever revert achieved). Return `true` (proceed even if revert partially failed, per user answer).

### 3.5 Guarded branch entry points (`src/chat-app/components/`)

- **New `BranchPicker.tsx`** (modeled on the 14f4c71 version, minus lifecycle context): `guardBranchNavigation()` → `aui.message().switchToBranch({position})`; disabled state replicates `useBranchPickerNext/Previous` (`branchNumber`, `branchCount`, `isRunning && !capabilities.switchBranchDuringRun`) plus an `isSwitching` latch. Update `UserMessage.tsx` and `AssistantMessage.tsx` imports (+ change-tracking comments per shadcn guidelines).
- **`AssistantActionBar.tsx`** (Refresh): replace `ActionBarPrimitive.Reload` with a `TooltipIconButton` whose onClick runs `guardBranchNavigation()` → `aui.message().reload()`; disabled per `useActionBarReload` semantics (`thread.isRunning || thread.isDisabled || message.role !== "assistant"`). Comment updated.
- **`EditComposer.tsx`** (Update button): replace `ComposerPrimitive.Send` wrapper with a Button: `guardBranchNavigation()` → `aui.composer().send()` (message-scoped edit composer); disabled when `!composer.canSend`. Comment updated.

### 3.6 "Clear pending changes" (`PendingLogseqChangesDisplay.tsx` + new runtime helper)

- Convert Tooltip → **Popover** (`src/shadcn/radix-ui/popover`): amber `GitCommitIcon` trigger; content shows the existing summary rows + a destructive-styled **"Clear pending changes"** button. Component still renders only when `getPendingLogseqChangesSummary(...).commandCount > 0`.
- **New `src/chat-app/runtime/cancelPendingToolCallsInThread.ts`**: export repository (runtime + `ThreadStore`), find the last assistant message in `requires-action`; for each `tool-call` part with `result === undefined` (and unresolved approval), set `result: {success: false, error: "User canceled operation"}`, `isError: true`; set message status `{type: "incomplete", reason: "cancelled"}`; `runtime.import()` + patch `ThreadStore` (mirrors `persistLogseqReversibleTransactionTrackerArtifact`). This deliberately avoids `part().addToolResult()`, which would auto-resume the run in LocalRuntime (`local-thread-runtime-core.js:389` → `_runLoop`).
- Button onClick flow:
  1. `aui.thread().cancelRun()` if running; await `thread.isRunning === false` (short subscription/poll with timeout) so the adapter's abort settles before patching.
  2. `cancelPendingToolCallsInThread(...)` if last message is `requires-action`.
  3. Execute `new LogseqClearChangesTool().execute({}, {messages: currentMessages})` directly.
  4. `aui.thread().append({role: "assistant", startRun: false, content: [{type: "tool-call", toolCallId: generatedId, toolName: "logseq_clear_changes", args: {}, argsText: "{}", result, isError, artifact}]})` — LocalRuntime persists it via the history adapter and never resumes the run.

### 3.7 Cleanup of removed-feature consumers

- `AppContent.tsx`: remove hook + context provider.
- `Composer.tsx`: remove countdown UI + context import (drop change-note (i)).

### 3.8 Tests & docs

- Update tracker unit/basic/serializer tests: rename to `revertAppliedCommands`; rewrite "rolls back only commands applied by a failed incremental execute" and "ignores rollback failures" to new semantics (no rollback, failed command removed, `LogseqReversibleTransactionExecutionError`); rewrite "continues reverting older commands after a revert failure" to assert stop-at-failure + preserved applied count.
- New unit tests: `cancelPendingToolCallsInThread`, branch-guard decision logic (pure part extracted for testability).
- Delete lifecycle hook test; keep `PendingLogseqChangesDisplay` summary tests.
- Sweep `docusaurus/` for auto-revert/countdown mentions and update.
- Finish with `npx tsc --noEmit`, `pnpm test --run --reporter=dot --silent`, and `pnpm run check:fix` on modified files.

### Open items to verify during implementation
- `showConfirmModal` works from the chat sidebar (main-window ShadowWrapper) context — it uses the iframe modal system from plugin context, expected to work; verify.
- Exact disabled-state parity for the guarded Reload/Send/BranchPicker buttons against assistant-ui internals (v0.14.27 checked).
