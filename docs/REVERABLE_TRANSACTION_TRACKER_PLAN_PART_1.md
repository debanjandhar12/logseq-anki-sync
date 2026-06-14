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
execute(deterministicUUIDGenerator?: DeterministicUUIDGenerator), revert(), getChangedPages(), changedPages : PageIdentity[] = [].

The changedPages will be appended by the execute() method.

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
    constructor(
    private readonly pageName: string,
    private readonly properties?: Record<string, any>
    ) {}

    async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator): Promise<void> {
         // This is a special case due to which we are checking validation. For some reason,
         // logseq.Editor.createPage doesnt throw error if the page already exists. It just returns
         // the existing page.
         const existingPage = await logseq.Editor.getPage(pageName);
         if (existingPage) {
             throw new Error(`Page already exists: ${pageName}`);
         }
         
         const page = await logseq.Editor.createPage(pageName, properties, {
            redirect: false,
            customUUID: deterministicUUIDGenerator.getUUID()
        });
        this.changedPages.push(page.uuid);
    }

    async revert(): Promise<void> {
        await logseq.Editor.deletePage(this.pageName);
    }
}
```

### UpdateBlockCommand.ts
```
export class UpdateBlockCommand extends BaseReversibleCommand {
    private readonly originalContent;
    
    constructor(
    private readonly blockUuid: BlockIdentity,
    private readonly content: string
    ) {}

    async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator): Promise<void> {
        const originalBlock = await LogseqEditor.getBlock(blockUUID);
        if (!originalBlock) {
            throw new Error(`Block not found: ${blockUUID}`);
        }
        this.originalContent = originalBlock.content;
        await LogseqEditor.updateBlock(blockUUID, content);
    }
    
    async revert(): Promise<void> {
        await LogseqEditor.updateBlock(blockUUID, originalContent);
    }
}
```

### LogseqReversibleTransactionTracker.ts
```
export class LogseqReversibleTransactionTracker {
    private readonly commandQueue = new LogseqReversibleTransactionCommandQueue();

    private UUID_GENERATION_SEED = null;
    
    private changedPages: PageIdentity[] = [];

    constructor() {
        this.UUID_GENERATION_SEED = uuidv4();
    }
    
    constructor(UUID_GENERATION_SEED) {
        this.UUID_GENERATION_SEED = UUID_GENERATION_SEED;
    }

    public getUuidGenerationSeed(): string {
        return this.UUID_GENERATION_SEED;
    }
    
    public getCommands(): LogseqReversibleCommand[] {
        return this.commandQueue.getCommands();
    }

    public addCommand(command: BaseReversibleCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.UUID_GENERATION_SEED = uuidv4();
    }

    public async execute() {
        const deterministicUUIDGenerator = new DeterministicUUIDGenerator(
            this.UUID_GENERATION_SEED
        );

        let lastCommandResult = null; // for returning the result of the last command
        const executedCommands: BaseReversibleCommand[] = [];
        try {
            for (const command of this.commandQueue.getCommands()) {
                lastCommandResult = await command.execute(this.deterministicUUIDGenerator);
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
always contain UUID references:

```ts
block.parent = {uuid: parentUuid};
block.page = {uuid: pageUuid};
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
    pageName: z.string().describe("Name of the Logseq page to create."),
    properties: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Optional Logseq page properties to set on the new page.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandDataSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage")
});

export class CreatePageCommand extends BaseReversibleCommand {
    public constructor(public readonly args: CreatePageCommandArgs) {
        super();
    }

    // execute() and revert() use this.args.pageName and this.args.properties
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
            uuidGenerationSeed: tracker.getUuidGenerationSeed(),
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
