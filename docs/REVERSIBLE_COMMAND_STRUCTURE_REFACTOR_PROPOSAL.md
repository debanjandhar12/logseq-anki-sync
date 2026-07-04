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

Recommended rule:

> If data is part of the serialized command shape, make it a named readonly command property or keep it
> in `args`. If data is only needed while reverting the current in-memory execution, keep it private and
> do not include it in the codec.

## Proposed Command Shape

Each command should have only the pieces it actually needs:

- `ArgsSchema`: validates model/user intent and remains exported for tool schemas.
- `Args` type: inferred from `ArgsSchema`.
- `SerializedSchema`: `ArgsSchema` plus `type` and any durable generated identifiers.
- Command class: stores `args` and durable identifiers as public readonly properties.
- Codec: delegates repeated encode/decode mechanics to a small helper.

Example target shape for `CreatePageCommand`:

```ts
export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandSerializedSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage"),
    pageUuid: LogseqUUIDSchema
});

export class CreatePageCommand extends BaseReversibleCommand {
    public readonly args: CreatePageCommandArgs;
    public readonly pageUuid: string;

    public constructor(args: CreatePageCommandArgs, pageUuid = uuidv4()) {
        super();
        this.args = CreatePageCommandArgsSchema.parse(args);
        this.pageUuid = LogseqUUIDSchema.parse(pageUuid);
    }
}
```

The codec should encode `pageUuid` directly instead of calling `getState()`.

```ts
export const CreatePageCommandCodec = createReversibleCommandCodec({
    type: "CreatePage",
    serializedSchema: CreatePageCommandSerializedSchema,
    commandSchema: z.instanceof(CreatePageCommand),
    decode: ({pageUuid, ...args}) => new CreatePageCommand(args, pageUuid),
    encodeData: (command) => ({...command.args, pageUuid: command.pageUuid})
});
```

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

Prefer passing durable generated identifiers directly instead of wrapping them in a `state` object.

Current:

```ts
new CreatePageCommand(args, {pageUuid});
new InsertBlockCommand(args, {blockUuid});
```

Proposed:

```ts
new CreatePageCommand(args, pageUuid);
new InsertBlockCommand(args, blockUuid);
```

This removes `Partial<CreatePageCommandState>` and `Partial<InsertBlockCommandState>`. There is no
benefit to a partial state object when each command currently has one durable generated identifier.

If a future command has multiple durable generated identifiers, prefer a clearly named second argument:

```ts
new SomeCommand(args, {createdPageUuid, createdBlockUuid});
```

Do not call that object `state`; call it `identifiers`, `durableData`, or another command-specific name.

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
7. Update serializer tests to assert the serialized JSON is unchanged.
8. Run command serializer tests, TypeScript, and Biome checks for modified files.

## Non-Goals

- Do not serialize runtime undo snapshots as part of this refactor.
- Do not change artifact JSON shape.
- Do not add artifact migrations unless a future shipped version requires backward compatibility.
- Do not merge all command classes into one generic command type.
- Do not remove command-specific schemas used by tools and JSON schema generation.

## Decision: Do Not Serialize Runtime Undo Snapshots

Runtime undo snapshots should remain in-memory only.

The snapshot may be used a long time after it was captured if it is serialized into an artifact. By
then, the graph may have changed substantially: blocks can move, pages can be renamed, content can be
edited, and deleted entities can be recreated. Replaying an old snapshot as if it still describes the
current graph risks corrupting newer user work.

Only durable command identity should be serialized, such as generated `pageUuid` and `blockUuid` values
owned by create-style commands. Execution-time rollback data such as `originalContent`, `deletedPage`,
`deletedBlockLocation`, `tempPageUUID`, and move-position snapshots should stay private and
runtime-only.
