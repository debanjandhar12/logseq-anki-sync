# Part 1: Command And Tool Changes

## Goal

Make every reversible command safe to serialize between execution and reversion, remove repeated codec boilerplate, and change mutation tools from execute/revert pairs to delayed temporary changes.

## Scope

Primary files:

- `src/core/logseq-reversible-transaction-tracker/commands/*`
- `src/core/logseq-reversible-transaction-tracker/commands/createReversibleCommandCodec.ts`
- `src/core/logseq-reversible-transaction-tracker/commands/index.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionCommandSerializer.ts`
- `src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTrackerSerializer.ts`
- `src/chat-app/tools/impl/*Logseq*Tool.tsx`
- `src/chat-app/tools/transaction/*`
- `src/chat-app/tools/base/*`

Tests should be added under the corresponding `tests/src` directories.

## Command State Model

Add a command-specific state schema to every command. The common shape is:

```ts
const CommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    // Command-specific fields follow.
});
```

Do not create a shared persistent/executed state helper. Each command may retain fields after reverting when they are useful for future execution. The state schema is deliberately allowed to contain all command-owned data needed by the command.

Each command stores the parsed state in one property exposed through a common base-class method such as `getCommandState()`. Command methods update `status` explicitly:

- Fresh commands begin with `status: "new"`.
- Successful execution changes status to `"executed"` and stores rollback data.
- Successful immediate reversion changes status to `"new"` while retaining any useful re-execution data.
- A command rejects execution when already executed.
- A command rejects reversion when new.

The tracker remains responsible for `appliedCommandCount`; command status is not used to determine command ordering.

## Command Inventory

Migrate each command according to the data its execute and revert methods actually require:

- `CreatePageCommand`: retain the stable page UUID in command state.
- `InsertBlockCommand`: retain the stable block UUID and any state needed to identify the inserted block.
- `CreateTagPageCommand`: retain the stable tag page UUID and remove redundant created-UUID runtime state.
- `UpdateBlockCommand`: persist the original block content.
- `DeletePageCommand`: persist only the minimum page data required by its revert implementation, not a whole Logseq entity unless it is genuinely needed.
- `DeleteBlockCommand`: persist the original position and temporary deleted-page UUID.
- `MoveBlockCommand`: persist the original previous block and parent/sibling relationship.
- `RenamePageCommand`: persist the original page name.
- `UpsertPropertyToBlockCommand`: persist the resolved property key, previous value, and whether a previous value existed.
- `DeletePropertyFromBlockCommand`: persist the resolved property key, previous value, and whether a previous value existed.
- Tag and tag-property commands: persist their lifecycle status and any command-specific fields needed by the current implementation.
- Read commands: use the same status-bearing state shape even though their revert operation is a no-op.

Do not serialize arbitrary Logseq entities by default. Store the smallest JSON-compatible values required for re-execution and reversion.

## Generic Codec

Refactor `createReversibleCommandCodec` so command files provide only:

- `type`.
- `argsSchema`.
- `commandStateSchema`.
- The command class.

The helper should generate a serialized schema like:

```ts
z.object({
    type: z.literal(type),
    args: argsSchema,
    commandState: commandStateSchema
});
```

Encoding should read `command.args` and `command.getCommandState()`. Decoding should call the common constructor shape with parsed args and command state.

The discriminated union in `commands/index.ts` remains the registry of all command codecs.

## Artifact Migration

Existing persisted messages use the old flattened command format. The serializer must support reading them because thread files are persisted application data.

Migration behavior:

- Recognize the old command shape.
- Move old command arguments and generated IDs into the new `args` and `commandState` fields.
- Treat old commands as `status: "new"` because the previous format did not persist applied progress.
- Preserve old tracker artifacts that were already reverted by the previous immediate-execution design.
- Serialize all newly produced artifacts in the new format.

The tracker serializer should also migrate old tracker data that lacks `appliedCommandCount` and `changedPages`, defaulting them to safe empty/new values.

## Tool Execution Flow

Create or update a shared helper for mutation tools. The target flow is:

```ts
const tracker = getLastLogseqReversibleTransactionTracker(context?.messages);
tracker.addCommand(new UpdateBlockCommand(args));

const result = await tracker.execute();

return ChatToolResponse.success(
    {result},
    createLogseqReversibleTransactionTrackerArtifact(tracker)
);
```

The tool must not call `revert()` or `revertImmediately()` after ordinary execution. The React lifecycle hook will schedule cleanup after observing the returned artifact.

The tool execution context should continue to pass the abort signal. Mutation helpers should check it before beginning a command operation so a canceled thread does not start additional work.

## Read-Only Tool Flow

Keep `ReadBlock`, text search, and DataScript query commands in the tracker because they must observe temporary graph changes.

Do not schedule a revert solely because a read command was added. Add a tracker query such as `hasAppliedGraphMutations()` or equivalent command classification so read-only commands do not create a misleading pending-changes state.

The read commands still execute under the tracker lock and remain ordered relative to mutation commands.

## Commit Tool

Update `LogseqCommitChangesTool` as follows:

- Cancel the lifecycle hook debounce before diff preparation.
- Use one tracker instance for review preparation and approval.
- Execute pending commands.
- Capture changed pages and the after snapshot.
- Call `revertImmediately()`.
- Capture the before snapshot.
- Save the reverted tracker artifact back to the current tool-call message.
- Show the review modal.
- On approval, execute the same tracker again and clear it without reverting.
- On rejection or modal dismissal, leave the tracker reverted and persist its state.

The approval path must not deserialize the old message artifact again after review preparation, because that artifact may still describe the pre-review applied state.

Add a lifecycle-context method for canceling the hook timer. The commit tool's custom renderer should call it before starting review.

## Clear Changes Tool

With delayed temporary changes, `LogseqClearChangesTool` must not only clear the command list.

Its flow becomes:

1. Load the current tracker.
2. Call `revertImmediately()` when graph mutations are applied.
3. Clear the tracker.
4. Return and persist the empty artifact.

This prevents clearing the metadata while leaving temporary graph changes in Logseq.

## Tests

Add tests for:

- Each command's state round trip.
- New and executed command statuses.
- Retaining command state after reversion when applicable.
- Generic codec encode/decode behavior.
- Generated identifiers surviving serialization.
- Runtime rollback snapshots surviving serialization.
- Legacy flattened command artifacts being migrated.
- Tracker artifacts containing `appliedCommandCount` and `changedPages`.
- Mutation tools no longer calling immediate revert after ordinary execution.
- Read-only commands remaining in the tracker without being treated as graph changes.
- Commit review using execute, immediate revert, and the same tracker for approval.
- Clear changes reverting before clearing.

## Acceptance Criteria

- Every command can be serialized after execution and deserialized before reversion.
- No command manually defines the repeated codec plumbing.
- No ordinary mutation tool immediately reverts its tracker.
- Read commands still see temporary graph changes.
- Commit review does not leave temporary changes applied while showing the before/after diff.
- Existing persisted artifacts are readable.
