# Background

The current logseq-fakeable-transaction-tracker is too hard to maintain. It was meant to perform changes in memory when ai calls the tools and once the printed diff is approved by user (LogseqInMemoryDataPrinter.ts), the logseq executor will actually make the changes.

The idea was excellent. However, it is almost impossible in practice since logseq has a lot of validations and behavior edge cases. Mapping them all would be very hard. (We failed miserably when we tried adding properties and tags based commands)

Hence, we need to re-implement the whole thing with a new strategy.

# New Strategy

We will create a logseq-reversible-transaction-tracker instead of logseq-fakeable-transaction-tracker.

The basic idea is we will apply changes and quickly revert them back. To do so, we will need to add a reversal way to commands.

# Structure Changes

## New Src Structure
```
logseq-reversible-transaction-tracker (inside `src/core`)
    commands/
        index.ts
        BaseReversibleCommand.ts
        CreatePageCommand.ts
        ... other commands
        utils/
            normalizeBlock.ts
            normalizePage.ts
    DeterministicUUIDGenerator.ts
    LogseqReversibleTransactionTracker.ts
    LogseqReversibleTransactionCommandQueue.ts
    LogseqReversibleTransactionCommandSerializer.ts
    LogseqReversibleTransactionTrackerSerializer.ts
    LogseqPageDataPrinter.ts
    types.ts
    index.ts
```

## New Test Structure
```
logseq-reversible-transaction-tracker (inside `tests/src/core`)
    DeterministicUUIDGenerator.test.ts (same test file)
    LogseqReversibleTransactionTracker.test.ts (new test file, tests will skip if !globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)
    commands/utils/normalizeBlock.test.ts
    commands/utils/normalizePage.test.ts
```

# Code

### BaseReversibleCommand.ts

We will define abstract class `BaseReversibleCommand` that all commands will extend. This will have abstract method:
execute(deterministicUUIDGenerator: DeterministicUUIDGenerator), revert(), getChangedPages(), changedPages : PageIdentity[] = [].

The changedPages will be appended by the execute() method.

`BaseReversibleCommand` defines the shared runtime behavior implemented by every command. It is
not the type stored by the transaction tracker. The tracker and its command queue must use
`LogseqReversibleCommand`, the codec-derived union of all supported concrete command classes,
because every tracked command must be serializable. Concrete commands continue to extend
`BaseReversibleCommand`. [Note: Please add this as comment somewhere in code.]

### Simplify types.ts

The new implementation should remove all types that exist only for the in-memory executor:

- `InMemoryEntityReference`
- `InMemoryEntityBaseKeys`
- `InMemoryEntityBase`
- `InMemoryBlockEntity`
- `InMemoryPageEntity`
- `InMemoryLogseqEntity`
- `InMemoryDB`

Use Logseq's existing `BlockEntity`, `PageEntity`, `BlockIdentity`, `PageIdentity`, and `EntityID`
types directly. Avoid introducing another parallel entity model or broad project-specific aliases
when a Logseq type already describes the value.

Keep `types.ts` small. It should contain only genuinely shared types, such as transaction result
types. Keep each Zod-inferred command type beside its schema instead of collecting all command
types in `types.ts`.

### CreatePageCommand.ts
```
export class CreatePageCommand extends BaseReversibleCommand {
    private pageUUID: BlockUUID | undefined;

    constructor(public readonly args: CreatePageCommandArgs) {
        super();
    }

    async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator): Promise<void> {
        // This is a special case due to which we are checking validation. For some reason,
        // logseq.Editor.createPage doesnt throw error if the page already exists. It just returns
        // the existing page. Also, getPage can return a page that is currently in Logseq's
        // recycle state. Recycled pages should be restored, not treated as active duplicates.
        const existingPage = await logseq.Editor.getPage(this.args.pageName);
        if (existingPage && !isDeletedPage(existingPage)) {
            throw new Error(`Page already exists: ${this.args.pageName}`);
        }

        if (existingPage) {
            // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
            await logseq.Editor.restorePage(existingPage.uuid);
            const page = normalizePage(await logseq.Editor.getPage(existingPage.uuid));
            this.pageUUID = page.uuid;
            this.changedPages.push(page.uuid);
            return page;
        }

        const rawPage = await logseq.Editor.createPage(this.args.pageName, undefined, {
            redirect: false,
            customUUID: deterministicUUIDGenerator.getUUID()
        });
        const page = normalizePage(rawPage);
        this.pageUUID = page.uuid;
        this.changedPages.push(page.uuid);
        return page;
    }

    async revert(): Promise<void> {
        if (!this.pageUUID) throw new Error("Execute must be called before revert");

        await logseq.Editor.deletePage(this.pageUUID);
    }
}
```

### UpdateBlockCommand.ts
```
export class UpdateBlockCommand extends BaseReversibleCommand {
    private originalContent;
    
    constructor(public readonly args: UpdateBlockCommandArgs) {
        super();
    }

    async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator): Promise<void> {
        const originalBlock = await LogseqEditor.getBlock(this.args.blockUUID);
        if (!originalBlock) {
            throw new Error(`Block not found: ${this.args.blockUUID}`);
        }
        this.originalContent = originalBlock.content;
        await LogseqEditor.updateBlock(this.args.blockUUID, this.args.content);
    }
    
    async revert(): Promise<void> {
        if (!this.originalContent) {
            throw new Error(`Execute must be called before revert`);
        }
        await LogseqEditor.updateBlock(this.args.blockUUID, this.originalContent);
    }
}
```

### LogseqReversibleTransactionTracker.ts
```
export class LogseqReversibleTransactionTracker {
    private readonly commandQueue = new LogseqReversibleTransactionCommandQueue();

    private UUID_GENERATION_SEED = null;
    
    private changedPages: PageIdentity[] = [];

   
    constructor(UUID_GENERATION_SEED?: string) {
        this.UUID_GENERATION_SEED = UUID_GENERATION_SEED ?? uuidv4();
    }

    public getUUIDGenerationSeed(): string {
        return this.UUID_GENERATION_SEED;
    }
    
    public getCommands(): LogseqReversibleCommand[] {
        return this.commandQueue.getCommands();
    }

    public getChangedPages(): PageIdentity[] {
        return this.changedPages;
    }

    public addCommand(command: LogseqReversibleCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.changedPages = [];
        this.UUID_GENERATION_SEED = uuidv4();
    }

    public async execute() {
        const deterministicUUIDGenerator = new DeterministicUUIDGenerator(
            this.UUID_GENERATION_SEED
        );

        let lastCommandResult = null; // for returning the result of the last command
        const executedCommands: LogseqReversibleCommand[] = [];
        try {
            for (const command of this.commandQueue.getCommands()) {
                lastCommandResult = await command.execute(deterministicUUIDGenerator);
                executedCommands.push(command);
                this.changedPages = [
                    ...this.changedPages,
                    ...command.getChangedPages()
                ];
            }
        } catch (error) {
            for (const command of executedCommands.reverse()) { // rollback
                await command.revert(); // pass error if any to caller
            }
            throw error; // rethrow error
        }

        return lastCommandResult;
    }
    
    public async revert() : boolean {
        for (const command of [...this.commandQueue.getCommands()].reverse()) {
            await command.revert(); // pass error if any to caller
        }
        return true;
    }
```

# LogseqPageDataPrinter.ts
```
export class LogseqPageDataPrinter {
    // same as before except we will print the changedPages
    public static print(changedPages: PageIdentity[]): string {
    }
}
```

### normalizeBlock.ts and normalizePage.ts

Commands must normalize entities returned by Logseq before returning them. Logseq may return
`block.parent` and `block.page` as numeric IDs or `{id}` references. The normalized block must
always contain UUID references. Also, if the block or page only contains id and not uuid, we need to call getPage or getBlock to get the uuid.:

```ts
block.parent = {uuid: parentUUID};
block.page = {uuid: pageUUID};
```

`normalizeBlock(block)` will:

- Return a `BlockEntity` with `parent` and `page` represented as `{uuid}`.
- Preserve a reference that already contains a UUID.
- Resolve a numeric or `{id}` `page` reference by calling `getPage`.
- Resolve a numeric or `{id}` `parent` reference by loading the referenced entity and using
  `logseq.Editor.isPageBlock(entity)` to determine whether it is a page or a regular block.
- Call `getBlock` or `getPage` as required to obtain the parent entity's UUID.
- Throw an error when a required `parent` or `page` reference cannot be resolved.
- Normalize returned child blocks recursively when the Logseq operation includes children.

`normalizePage(page)` will return a `PageEntity` with its canonical UUID and recursively normalize
any returned block children using `normalizeBlock`.

Commands such as `CreatePageCommand`, `InsertBlockCommand`, and commands that return an updated or
moved block must call `normalizePage` or `normalizeBlock` on the value returned by Logseq before
returning it to the transaction tracker.

### Serialization with Zod

Use Zod 4 codecs as the single source of truth for both serialization and deserialization. A codec
validates serialized JSON, constructs the command when decoding, and converts the command back to
JSON when encoding. This removes the command serializer's manual `switch` and the
`fromValidated()` methods.

Each command file will define one reusable arguments schema. The command codec extends that schema
with the serialization discriminator, while the corresponding chat tool imports the same arguments
schema for its `parameters`.

```ts
import {z} from "zod";

export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandDataSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage")
});

export class CreatePageCommand extends BaseReversibleCommand {
    public constructor(public readonly args: CreatePageCommandArgs) {
        super();
    }

    // execute() and revert() use this.args.pageName
}

export const CreatePageCommandCodec = z.codec(
    CreatePageCommandDataSchema,
    z.instanceof(CreatePageCommand),
    {
        decode: ({type: _, ...args}) => new CreatePageCommand(args),
        encode: (command) => ({
            type: "CreatePage",
            ...command.args
        })
    }
);
```

The tool no longer declares a duplicate `LogseqCreatePageArgsZodObj`:

```ts
import {
    CreatePageCommand,
    CreatePageCommandArgsSchema,
    type CreatePageCommandArgs
} from "src/core/logseq-reversible-transaction-tracker/commands";

export class LogseqCreatePageTool extends BaseChatToolWithDefaultUI<
    CreatePageCommandArgs,
    LogseqCreatePageResult
> {
    readonly parameters = CreatePageCommandArgsSchema;

    async execute(
        args: CreatePageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<LogseqCreatePageResult | ToolResponse<LogseqCreatePageResult>> {
        const transactionTracker = getLastLogseqReversibleTransactionTracker(
            context?.messages
        );
        transactionTracker.addCommand(new CreatePageCommand(args));
        // execute and return the response
    }
}
```

Apply the same structure to every editing tool and command. This establishes the correct dependency
direction: chat tools import command argument schemas from core; core transaction code never imports
from `src/chat-app/`.

Define one discriminated union containing every command codec:

```ts
export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    CreatePageCommandCodec,
    DeletePageCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    RenamePageCommandCodec,
    UpdateBlockCommandCodec
]);

export type SerializedLogseqReversibleCommand = z.input<
    typeof LogseqReversibleCommandCodec
>;

export type LogseqReversibleCommand = z.output<
    typeof LogseqReversibleCommandCodec
>;
```

Use `z.input` for the serialized JSON type and `z.output` for the decoded command-instance type.
The manual `SerializedLogseqFakeableCommand` union in `types.ts` is no longer required.

`LogseqReversibleTransactionCommandQueue` must likewise store and expose
`LogseqReversibleCommand[]`, rather than `BaseReversibleCommand[]`. This prevents adding a new
runtime command to a serializable transaction without also registering its codec in
`LogseqReversibleCommandCodec`.

The command serializer becomes:

```ts
export class LogseqReversibleTransactionCommandSerializer {
    public static serialize(
        command: LogseqReversibleCommand
    ): SerializedLogseqReversibleCommand {
        return z.encode(LogseqReversibleCommandCodec, command);
    }

    public static deserialize(json: unknown): LogseqReversibleCommand {
        return z.decode(LogseqReversibleCommandCodec, json);
    }
}
```

The tracker can use a codec too. Nested command codecs automatically encode and decode every
command:

```ts
const LogseqReversibleTransactionTrackerDataSchema = z.object({
    uuidGenerationSeed: z.uuid(),
    commands: z.array(LogseqReversibleCommandCodec)
});

export const LogseqReversibleTransactionTrackerCodec = z.codec(
    LogseqReversibleTransactionTrackerDataSchema,
    z.instanceof(LogseqReversibleTransactionTracker),
    {
        decode: ({uuidGenerationSeed, commands}) => {
            const tracker = new LogseqReversibleTransactionTracker(uuidGenerationSeed);
            for (const command of commands) tracker.addCommand(command);
            return tracker;
        },
        encode: (tracker) => ({
            uuidGenerationSeed: tracker.getUUIDGenerationSeed(),
            commands: tracker.getCommands()
        })
    }
);

export type SerializedLogseqReversibleTransactionTracker = z.input<
    typeof LogseqReversibleTransactionTrackerCodec
>;
```

The tracker serializer is then only:

```ts
export class LogseqReversibleTransactionTrackerSerializer {
    public static serialize(
        tracker: LogseqReversibleTransactionTracker
    ): SerializedLogseqReversibleTransactionTracker {
        return z.encode(LogseqReversibleTransactionTrackerCodec, tracker);
    }

    public static deserialize(json: unknown): LogseqReversibleTransactionTracker {
        return z.decode(LogseqReversibleTransactionTrackerCodec, json);
    }
}
```

Tests should cover valid round trips, malformed command fields, unknown command types, and invalid
tracker artifacts.

# Usage of LogseqReversibleTransactionTracker
Inside LogseqCreatePageTool etc, we will use the LogseqReversibleTransactionTracker.execute() method, store the result, revert them quickly and return the result.

Inside LogseqCommitChangesTool, we will use the LogseqReversibleTransactionTracker.execute() after approval. For approval, we will use LogseqReversibleTransactionTracker.execute() first, then LogseqPageDataPrinter.print() methods with changedPages for afterChanges and then revert it and then call LogseqPageDataPrinter.print() again with same changedPages for before changes.

# Notes

## Reverting block and page deletion

The original implementation plan assumed deleted pages were permanently lost and had to be manually
recreated from snapshots. That assumption was wrong: Logseq keeps deleted pages in a recycle state
and exposes an unreleased `logseq.Editor.restorePage(pageNameOrUuid)` command that restores the page
and its blocks.

`logseq.Editor.getPage(...)` can return recycled pages. A recycled page can be detected by the raw
page field `:logseq.property/deleted-at`. Command validation must therefore distinguish active pages
from recycled pages instead of treating every `getPage` result as an existing active page.

`DeleteBlockCommand` still cannot revert from an entity UUID alone. Before deleting a block,
`execute()` must capture an immutable snapshot containing all data required to recreate the deleted
entity at the same logical location. The snapshot is execution state, not a constructor argument:
command serialization should continue to describe the requested operation, while `revert()` must fail
with a clear `execute() must be called before revert()` error when no snapshot is available.

Add focused utilities under `commands/utils/`, rather than duplicating traversal and restoration
logic:

- `captureBlockTree(blockUUID)` loads the block with `includeChildren: true`, fetches complete
  properties through `LogseqPropertiesHelper`, and converts the result into a plain immutable
  `DeletedBlockTreeSnapshot`.
- `restoreBlockTree(snapshot, destination)` recreates a block tree recursively.
- `isDeletedPage(page)` checks `page[":logseq.property/deleted-at"] != null` to identify recycled
  pages returned by `getPage`.

Block snapshots should retain the complete `BlockEntity` values returned by Logseq, including fields
that are not currently needed by the restore implementation. Keeping the full entities avoids losing
graph-specific metadata and gives future restoration logic access to fields that Logseq may make
writable later. The restore utilities should still extract the supported writable fields instead of
passing the captured entities directly to editor APIs.

### Block snapshot requirements

Each `DeletedBlockTreeSnapshot` must contain:

- The block UUID. Restoration must use `customUUID` so later commands and block references continue
  to resolve to the same identity.
- The block entity (along with block.properties and block.tags)
- The ordered child snapshots, recursively.

`DeleteBlockCommand.execute()` should capture and validate the complete snapshot before calling the
delete API. It must also add the containing page to `changedPages`. If capture is incomplete, the
delete must not proceed.

`DeleteBlockCommand.revert()` should:

1. Insert the root block with its original UUID, content, format, and original position.
2. Restore writable properties and graph-specific tag relations.
3. Recursively insert children in original order, preserving every child UUID.
4. Verify that the restored tree has the expected UUIDs, hierarchy, ordering, content, and
   properties. A mismatch must be reported as a revert failure rather than silently accepted.

Sibling anchors are necessary because other commands in the same transaction may temporarily
change surrounding blocks. The fallback index provides deterministic behavior when both anchors
are unavailable, but exact placement cannot be guaranteed if external edits occur between
`execute()` and `revert()`.

### Page recycle requirements

`DeletePageCommand` should rely on Logseq's recycle/restore behavior instead of manually recreating
the page and block tree.

`DeletePageCommand.execute()` should:

1. Load the page by UUID.
2. Fail if the page does not exist or is already recycled. Because `getPage` returns recycled pages,
   this requires checking `:logseq.property/deleted-at`, not just nullability.
3. Store the page object as execution state so `revert()` knows which page was deleted.
4. Record the page UUID in `changedPages`.
5. Call `logseq.Editor.deletePage(page.uuid)` directly.

`DeletePageCommand.revert()` should:

1. Fail if `execute()` has not stored the deleted page.
2. Call `logseq.Editor.getPage(page.uuid)` and allow the returned recycled page.
3. Fail only if a page with the same UUID is active, meaning it does not have
   `:logseq.property/deleted-at`.
4. Call `logseq.Editor.restorePage(page.uuid)`. This API may need `// @ts-ignore` until the Logseq
   plugin types include it.

`CreatePageCommand.execute()` has the symmetrical recycled-page case: if `getPage(pageName)` returns
a recycled page, it should restore that page instead of calling `createPage`. If `getPage(pageName)`
returns an active page, it must still fail with `Page already exists`.

### Failure handling and tests

Block restoration is a multi-step operation and can fail after creating part of the tree. The restore
utilities must track entities created during the current attempt and perform best-effort cleanup in
reverse order before rethrowing the original error. Cleanup errors should be attached to the
reported revert error, not replace it. Page restoration should be delegated to Logseq's
`restorePage` API instead of implementing a manual multi-step page rebuild.

Tests must cover:

- A leaf block and a deeply nested block tree.
- Top-level and nested block placement at the start, middle, and end of siblings.
- Block and page properties, tags, references, empty content, and mixed block formats.
- UUID, hierarchy, and sibling-order preservation.
- A page with properties and multiple top-level trees.
- Journal and namespaced pages where supported by the Logseq API.
- Missing parents/anchors, conflicting page names or UUIDs, partial restore failure, repeated
  `revert()`, and `revert()` before `execute()`.
- Separate behavior for file graphs and DB graphs because property and tag storage differ.
- Recycled-page behavior: `CreatePageCommand.execute()` restores a recycled page with the requested
  name, `DeletePageCommand.execute()` refuses to delete an already recycled page, and
  `DeletePageCommand.revert()` accepts the recycled page returned by `getPage` before calling
  `restorePage`.

Before implementation, add an integration spike against a running Logseq instance to confirm which
fields can be round-tripped through `insertBlock` and property APIs for block deletion, and confirm
the exact runtime behavior of `deletePage`, recycled-page `getPage`, and `restorePage` for page
deletion. The command contract should promise exact restoration only for fields proven writable or
restorable by those APIs.
