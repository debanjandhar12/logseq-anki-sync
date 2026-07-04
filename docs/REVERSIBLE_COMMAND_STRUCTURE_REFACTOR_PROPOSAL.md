# Reversible Command Structure Refactor Proposal

Status: **Proposal - not implemented.**

## Goal

Reduce repeated typing and codec boilerplate across all reversible transaction commands while making
the command model clearer.

The current command files repeat the same pattern:

- Define an args schema.
- Infer an args type.
- Extend the args schema with `type` to define serialized data.
- Define a command class with `args`.
- Hand-write a `z.codec` with nearly identical `decode` and `encode` logic.
- Add `getState()` only when private generated identifiers need to be serialized.

`getState()` is the most confusing part. In the current implementation it does not expose runtime undo
state. It exposes durable command data such as `pageUuid` and `blockUuid`, which must be serialized so
commands can be re-executed or reverted after artifact round trips.

## Current Problem

`CreatePageCommand` and `InsertBlockCommand` currently keep generated entity UUIDs private and expose
them through `getState()` for serialization.

```ts
private readonly pageUuid: string;

public getState(): CreatePageCommandState {
    return {pageUuid: this.pageUuid};
}
```

That name suggests general command state, but the value is actually part of the command's durable
serialized identity. It is not the same kind of state as `originalContent`, `deletedPage`, or
`originalPreviousBlockUuid`, which are execution-time undo snapshots.

This makes the model harder to reason about because two different concepts are mixed under the word
"state":

| Concept | Example | Should serialize today? | Purpose |
|---------|---------|-------------------------|---------|
| Durable command data | `pageUuid`, `blockUuid` | Yes | Keep generated entity identity stable across artifact round trips. |
| Runtime undo snapshot | `originalContent`, `deletedPage`, move/delete positions | No, unless rollback after deserialize is explicitly supported | Revert a command already executed in this in-memory transaction. |

## Proposed Rule

Use explicit public readonly properties for durable command data. Do not use `getState()`.

Recommended rules:

> 1. If data is part of the serialized command shape, make it a named readonly command property or keep it
>    in `args`. If data is only needed while reverting the current in-memory execution, keep it private and
>    do not include it in the codec.
> 2. The `serializedState` constructor parameter type is always derived from the serialized schema
>    (`Omit<XCommandSerialized, "type" | keyof XCommandArgs>`), never hand-written.
> 3. Every command constructor has the same shape — `constructor(args, serializedState?: Partial<...>)`
>    — even when it has no serialized state beyond `args` (the derived type then resolves to `{}`).
> 4. Every command file starts with a JSDoc block that enumerates its fields in two groups —
>    **Serialized (durable) data** and **Runtime-only data** — so a reader can see at a glance what
>    survives serialization and what is in-memory undo state. Example:
>
>    ```ts
>    /**
>     * Moves a block to a destination block or page.
>     *
>     * Serialized data: srcBlockUuid, destBlockUuid, before, children
>     * Runtime-only data: original position snapshot (previousBlockUuid, isPreviousBlockParent) — used only to revert the current in-memory execution.
>     */
>    ```

## Proposed Command Shape

Each command should have only the pieces it actually needs:

- `ArgsSchema`: validates model/user intent and remains exported for tool schemas.
- `Args` type: inferred from `ArgsSchema`.
- `SerializedSchema`: `ArgsSchema` plus `type` and any serialized state fields (e.g. generated UUIDs).
- Command class: stores `args` and serialized state as public readonly properties.
- Codec: delegates repeated encode/decode mechanics to a small helper.
- **File-level JSDoc** documenting serialized vs. runtime-only fields (see below).

Example target shape for `CreatePageCommand`:

```ts
/**
 * Creates a Logseq page with a stable UUID.
 *
 * Serialized (durable) data:
 *   - args.pageName
 *   - pageUuid
 *
 * Runtime-only (not serialized):
 *   - none
 */
export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandSerializedSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage"),
    pageUuid: LogseqUUIDSchema
});

export type CreatePageCommandSerializedState = Omit<
    z.infer<typeof CreatePageCommandSerializedSchema>,
    "type" | keyof CreatePageCommandArgs
>;

export class CreatePageCommand extends BaseReversibleCommand {
    public readonly args: CreatePageCommandArgs;
    public readonly pageUuid: string;

    public constructor(
        args: CreatePageCommandArgs,
        serializedState?: Partial<CreatePageCommandSerializedState>
    ) {
        super();
        this.args = CreatePageCommandArgsSchema.parse(args);
        this.pageUuid = LogseqUUIDSchema.parse(serializedState?.pageUuid ?? uuidv4());
    }
}
```

The codec should encode `pageUuid` directly instead of calling `getState()`.

```ts
export const CreatePageCommandCodec = createReversibleCommandCodec({
    type: "CreatePage",
    serializedSchema: CreatePageCommandSerializedSchema,
    commandSchema: z.instanceof(CreatePageCommand),
    decode: ({pageUuid, ...args}) => new CreatePageCommand(args, {pageUuid}),
    encodeData: (command) => ({...command.args, pageUuid: command.pageUuid})
});
```

### Deriving the serialized-state type

Do not hand-write the `serializedState` parameter type. Derive it from the serialized schema so it
can never drift from what the codec actually encodes:

```ts
export type CreatePageCommandSerializedState = Omit<
    z.infer<typeof CreatePageCommandSerializedSchema>,
    "type" | keyof CreatePageCommandArgs
>;
```

This subtracts the discriminant and everything already in `args`, leaving exactly the serialized
fields beyond `args` (`pageUuid` here). The constructor takes `Partial<...>` of it so callers may omit
every key when they want new UUIDs generated. For commands with no serialized state beyond `args` the
derived type is `{}`, and the constructor's second parameter is still accepted (and optional) — see
"Constructor Style" below.

## Codec Helper

Introduce one helper for the repeated `z.codec` pattern.

Expected responsibilities:

- Attach the command `type` during encoding.
- Strip the discriminant before passing serialized data into command constructors.
- Keep Zod validation at the codec boundary.
- Preserve `z.discriminatedUnion("type", [...])` in `commands/index.ts`.

Sketch:

```ts
type ReversibleCommandCodecOptions<Serialized, Command> = {
    type: Serialized extends {type: infer Type} ? Type : never;
    serializedSchema: z.ZodType<Serialized>;
    commandSchema: z.ZodType<Command>;
    decode: (data: Omit<Serialized, "type">) => Command;
    encodeData: (command: Command) => Omit<Serialized, "type">;
};

function createReversibleCommandCodec<Serialized extends {type: string}, Command>(
    options: ReversibleCommandCodecOptions<Serialized, Command>
) {
    return z.codec(options.serializedSchema, options.commandSchema, {
        decode: ({type: _, ...data}) => options.decode(data),
        encode: (command) => ({type: options.type, ...options.encodeData(command)})
    });
}
```

The exact generic types can be adjusted during implementation. The important part is the API: command
files should declare only command-specific serialized fields, not repeat codec plumbing.

## Command-by-Command Changes

| Command | Durable serialized data | Runtime-only undo data | Proposed change |
|---------|--------------------------|------------------------|-----------------|
| `CreatePageCommand` | `args.pageName`, `pageUuid` | None currently | Make `pageUuid` public readonly. Remove `CreatePageCommandState` and `getState()`. |
| `InsertBlockCommand` | `args.parentUuid`, `args.content`, insert options, `blockUuid` | None currently | Make `blockUuid` public readonly. Remove `InsertBlockCommandState` and `getState()`. |
| `UpdateBlockCommand` | `args.blockUuid`, `args.content` | `originalContent` | Use the shared codec helper. Keep `originalContent` private and runtime-only. |
| `DeleteBlockCommand` | `args.blockUuid` | `deletedBlockLocation`, `tempPageUUID` | Use the shared codec helper. Keep delete snapshots private and runtime-only unless deserialize-and-revert support is added. |
| `DeletePageCommand` | `args.pageUuid` | `deletedPage` | Use the shared codec helper. Keep `deletedPage` private and runtime-only unless full page restore snapshots become serialized. |
| `MoveBlockCommand` | `args.srcBlockUuid`, `args.destBlockUuid`, move options | original position snapshot | Use the shared codec helper. Keep position snapshot private and runtime-only unless rollback after deserialize is required. |
| `RenamePageCommand` | `args.pageUuid`, `args.newName` | `originalName`, `pageUUID` | Use the shared codec helper. Keep original name private and runtime-only. |

## Naming

Rename `*DataSchema` to `*SerializedSchema` as commands are touched.

`DataSchema` is vague. `SerializedSchema` describes its actual role: the JSON-compatible command shape
stored in tracker artifacts.

Recommended names:

| Current | Proposed |
|---------|----------|
| `CreatePageCommandDataSchema` | `CreatePageCommandSerializedSchema` |
| `InsertBlockCommandDataSchema` | `InsertBlockCommandSerializedSchema` |
| `SerializedLogseqReversibleCommand` | Keep as-is |
| `LogseqReversibleCommand` | Keep as-is |

## Constructor Style

Every command constructor has the same two-parameter shape, regardless of whether it has any
serialized state beyond `args`:

```ts
constructor(args: XCommandArgs, serializedState?: Partial<XCommandSerializedState>)
```

Rules:

- **Always use this shape** — even for commands with no serialized state beyond `args`. For those, the
  derived `XCommandSerializedState` resolves to `{}`, so the second parameter is effectively ignored,
  but the signature stays uniform across all seven commands. A reader never has to check whether a given
  command takes a second argument; it always does.
- The argument object contains **only** fields that survive serialization (typically generated UUIDs).
  Runtime-only undo snapshots (`originalContent`, `deletedPage`, move-position snapshots, etc.) stay
  private instance fields and are **never** passed through this object.
- Never use bare positional identifiers (`new XCommand(args, pageUuid)`). The parameter is always named
  `serializedState` — not the bare, ambiguous `state` (which collides conceptually with in-memory undo
  state), and not a command-specific name.
- The `Partial<...>` wrapper means callers omit any key they want generated fresh, and a caller creating
  a brand-new command can pass nothing (or `{}`) for the second argument.

Current call sites:

```ts
new CreatePageCommand(args);                // serializedState omitted → fresh pageUuid generated
new InsertBlockCommand(args);               // serializedState omitted → fresh blockUuid generated
new UpdateBlockCommand(args);               // serializedState omitted; type is {}
new MoveBlockCommand(args);                 // serializedState omitted; type is {}
```

Codec decode call sites pass the deserialized state back in:

```ts
new CreatePageCommand(args, {pageUuid});
new InsertBlockCommand(args, {blockUuid});
new UpdateBlockCommand(args, {});           // or simply (args) — both valid when type is {}
```

A hypothetical future command that creates multiple durable entities uses the same shape:

```ts
new SomeCommand(args, {createdPageUuid, createdBlockUuid});
```

## Serialization Behavior

Serialized output should remain behaviorally equivalent after the refactor.

Expected serialized `CreatePageCommand`:

```json
{
    "type": "CreatePage",
    "pageName": "Example",
    "pageUuid": "018f38a5-df13-74d1-bf02-14c17f252f28"
}
```

Expected serialized `InsertBlockCommand`:

```json
{
    "type": "InsertBlock",
    "parentUuid": "018f38a5-df13-74d1-bf02-14c17f252f28",
    "content": "Example block",
    "sibling": true,
    "blockUuid": "018f38a5-df13-74d1-bf02-14c17f252f29"
}
```

The refactor should not change persisted command shape unless explicitly chosen in a later migration.

## Implementation Plan

1. Add `createReversibleCommandCodec` near the command implementations, likely under `commands/utils` or `commands/createReversibleCommandCodec.ts`.
2. Convert `CreatePageCommand` first because it has the smallest generated-identifier pattern.
3. Convert `InsertBlockCommand` next and verify defaults still serialize as they do today.
4. Convert `UpdateBlockCommand`, `DeleteBlockCommand`, `DeletePageCommand`, `MoveBlockCommand`, and `RenamePageCommand` to the shared codec helper.
5. Rename `*DataSchema` to `*SerializedSchema` while touching each file.
6. Keep all runtime undo snapshots private and out of serialization.
7. Add the file-level JSDoc block (Serialized data / Runtime-only data) to each command file as it is touched.
8. Confirm every command constructor takes a `serializedState` second argument (as `Partial<XCommandSerializedState>`) so the shape is uniform across all commands.
9. Update serializer tests to assert the serialized JSON is unchanged.
10. Run command serializer tests, TypeScript, and Biome checks for modified files.

## Non-Goals

- Do not serialize runtime undo snapshots as part of this refactor.
- Do not change artifact JSON shape.
- Do not add artifact migrations unless a future shipped version requires backward compatibility.
- Do not merge all command classes into one generic command type.
- Do not remove command-specific schemas used by tools and JSON schema generation.

## Decision: Do Not Serialize Runtime Undo Snapshots

Runtime undo snapshots should remain in-memory only.

A command instance is typically used in one of two lifecycle patterns:

1. **In-memory (the common case):** `execute()` runs, then `revert()` runs immediately after within the
   same in-memory transaction (e.g. during preview/preview-rollback, or when the model's tool sequence
   is undone before the artifact is sealed). The runtime snapshot is captured and consumed in the same
   process while the graph is still in the expected state.
2. **Replayed after a round trip:** the command is serialized into the artifact, deserialized later, and
   may be `execute()`d (and optionally `revert()`ed) long after — potentially across sessions. Between
   serialization and replay the graph may have changed substantially: blocks can move, pages can be
   renamed, content can be edited, and deleted entities can be recreated. An old runtime snapshot captured
   against the old graph no longer describes reality and would corrupt newer user work if replayed.

Because the second pattern is real but the snapshot is only safe in the first, snapshots are kept
runtime-only and dropped on serialize. After a round trip, `execute()` re-captures a fresh snapshot from
the current graph, so pattern 2 still supports an immediate `execute()` → `revert()` pair.

Only durable command identity should be serialized, such as generated `pageUuid` and `blockUuid` values
owned by create-style commands. Execution-time rollback data such as `originalContent`, `deletedPage`,
`deletedBlockLocation`, `tempPageUUID`, and move-position snapshots should stay private and
runtime-only.
