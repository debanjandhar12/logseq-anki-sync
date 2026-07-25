# Reversible Command Structure Refactor Proposal

Status: **Proposal - not implemented.**

## Summary

Refactor the reversible transaction command files so serialized command data is explicit, undo-only
runtime snapshots remain private, and command codecs no longer repeat the same `z.codec` plumbing.

The behavior should stay the same: serialized tracker artifacts must keep the same JSON shape, and
runtime rollback snapshots must not become part of persisted artifacts.

## Goals

- Reduce repeated command codec boilerplate.
- Make durable serialized data obvious in each command class.
- Remove the misleading `getState()` pattern used by create-style commands.
- Keep command schemas usable for tool schema generation.
- Preserve the existing serialized artifact shape.

## Current Problem

Each reversible command repeats the same structure:

- Define an args schema.
- Infer an args type.
- Extend the args schema with `type` to define serialized data.
- Define a command class with `args`.
- Hand-write a `z.codec` with nearly identical decode and encode logic.
- Add `getState()` only when private generated identifiers need to be serialized.

`getState()` is the most confusing part. In the current implementation it does not expose runtime
undo state. It exposes durable command data such as `pageUuid` and `blockUuid`, which must be
serialized so commands can be re-executed or reverted after artifact round trips.

Current `CreatePageCommand` shape:

```ts
private readonly pageUuid: string;

public getState(): CreatePageCommandState {
    return {pageUuid: this.pageUuid};
}
```

That name suggests general command state, but the value is actually part of the command's durable
serialized identity. It is not the same kind of data as `originalContent`, `deletedPage`,
`deletedBlockLocation`, `tempPageUUID`, or move-position snapshots, which are execution-time undo
snapshots.

## Data Model Rule

Use separate names and storage for the two kinds of command data:

| Concept | Examples | Serialize? | Purpose |
|---------|----------|------------|---------|
| Durable serialized data | `args.pageName`, `args.blockUuid`, generated `pageUuid`, generated `blockUuid` | Yes | Defines the stable command identity stored in tracker artifacts. |
| Runtime-only undo snapshot | `originalContent`, `deletedPage`, `deletedBlockLocation`, `tempPageUUID`, move-position snapshots | No | Reverts a command that has already run in the current in-memory transaction. |

Rules:

1. If data is part of the serialized command shape, keep it in `args` or expose it as a named
   `public readonly` command property.
2. If data is only needed to revert the current in-memory execution, keep it private and exclude it
   from command codecs.
3. Do not use `getState()` for durable serialized fields. The serializer should read named command
   properties directly.
4. Add a command-level JSDoc block to each command class listing serialized data and runtime-only
   data.

Example JSDoc:

```ts
/**
 * Moves a block to a destination block or page.
 *
 * Serialized data:
 * - args.srcBlockUuid
 * - args.destBlockUuid
 * - args.before
 * - args.children
 *
 * Runtime-only data:
 * - original previous-position snapshot used to revert the current in-memory execution
 */
```

## Target Command Shape

Each command file should contain only command-specific pieces:

- `ArgsSchema`: validates user/model intent and remains exported for tool schemas.
- `ArgsInput` type when useful: `z.input<typeof ArgsSchema>` for constructor callers.
- `Args` type: parsed command args, `z.output<typeof ArgsSchema>`.
- `SerializedSchema`: `ArgsSchema` plus `type` and any extra durable fields.
- `SerializedState` type: schema-derived durable fields beyond `args`.
- Command class: stores parsed `args` and any extra durable fields as readonly properties.
- Codec: delegates repeated encode/decode mechanics to a shared helper.

Important detail: constructors should accept schema input, but the `args` property should store
schema output. This matters for schemas with defaults, such as `InsertBlockCommandArgsSchema` and
`MoveBlockCommandArgsSchema`.

```ts
export type InsertBlockCommandArgsInput = z.input<typeof InsertBlockCommandArgsSchema>;
export type InsertBlockCommandArgs = z.output<typeof InsertBlockCommandArgsSchema>;
```

## Example: CreatePageCommand

Target shape:

```ts
/**
 * Creates a Logseq page with a stable UUID.
 *
 * Serialized data:
 * - args.pageName
 * - pageUuid
 *
 * Runtime-only data:
 * - none
 */
export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgsInput = z.input<typeof CreatePageCommandArgsSchema>;
export type CreatePageCommandArgs = z.output<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandSerializedSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage"),
    pageUuid: LogseqUUIDSchema
});

export type CreatePageCommandSerializedState = Omit<
    z.output<typeof CreatePageCommandSerializedSchema>,
    "type" | keyof CreatePageCommandArgs
>;

export class CreatePageCommand extends BaseReversibleCommand {
    public readonly args: CreatePageCommandArgs;
    public readonly pageUuid: string;

    public constructor(
        args: CreatePageCommandArgsInput,
        serializedState?: Partial<CreatePageCommandSerializedState>
    ) {
        super();
        this.args = CreatePageCommandArgsSchema.parse(args);
        this.pageUuid = LogseqUUIDSchema.parse(serializedState?.pageUuid ?? uuidv4());
    }
}
```

The codec should encode `pageUuid` directly instead of calling `getState()`:

```ts
export const CreatePageCommandCodec = createReversibleCommandCodec({
    type: "CreatePage",
    serializedSchema: CreatePageCommandSerializedSchema,
    commandSchema: z.instanceof(CreatePageCommand),
    decode: ({pageUuid, ...args}) => new CreatePageCommand(args, {pageUuid}),
    encodeData: (command) => ({...command.args, pageUuid: command.pageUuid})
});
```

## Deriving Serialized State

Do not hand-write the `serializedState` parameter type. Derive it from the serialized schema so it
cannot drift from what the codec encodes:

```ts
export type XCommandSerializedState = Omit<
    z.output<typeof XCommandSerializedSchema>,
    "type" | keyof XCommandArgs
>;
```

This subtracts the discriminant and everything already stored in `args`, leaving only serialized
fields beyond `args`. For `CreatePageCommand`, that is `{pageUuid: string}`. For
`InsertBlockCommand`, that is `{blockUuid: string}`. For commands such as `UpdateBlockCommand`, the
derived type is `{}`.

Only commands with extra durable fields need a `serializedState` constructor parameter. Avoid adding
unused parameters to commands whose serialized shape is exactly `type + args`.

## Constructor Style

Prefer these constructor shapes:

```ts
constructor(args: XCommandArgsInput)
constructor(args: XCommandArgsInput, serializedState?: Partial<XCommandSerializedState>)
```

Rules:

- Use the one-parameter form when the command has no durable serialized fields beyond `args`.
- Use the second `serializedState` parameter only for generated or otherwise durable fields outside
  `args`, such as `pageUuid` and `blockUuid`.
- Never pass runtime-only undo snapshots through `serializedState`.
- Never use bare positional identifiers such as `new XCommand(args, pageUuid)`. The optional second
  parameter must be an object named `serializedState`.
- Use `Partial<XCommandSerializedState>` when the command can generate omitted durable fields for a
  new command instance.

Current call sites remain simple:

```ts
new CreatePageCommand(args);      // fresh pageUuid generated
new InsertBlockCommand(args);     // fresh blockUuid generated
new UpdateBlockCommand(args);     // no extra durable state
new MoveBlockCommand(args);       // no extra durable state
```

Codec decode call sites pass durable state back only when it exists:

```ts
new CreatePageCommand(args, {pageUuid});
new InsertBlockCommand(args, {blockUuid});
new UpdateBlockCommand(args);
```

## Codec Helper

Introduce one helper for the repeated `z.codec` pattern, likely in
`commands/createReversibleCommandCodec.ts` or `commands/utils/createReversibleCommandCodec.ts`.

Responsibilities:

- Attach the command `type` during encoding.
- Strip the discriminant before passing serialized data into command constructors.
- Keep Zod validation at the codec boundary.
- Preserve `z.discriminatedUnion("type", [...])` in `commands/index.ts`.
- Keep command files responsible only for command-specific fields.

API sketch:

```ts
type ReversibleCommandCodecOptions<Serialized extends {type: string}, Command> = {
    type: Serialized["type"];
    serializedSchema: z.ZodType<Serialized>;
    commandSchema: z.ZodType<Command>;
    decode: (data: Omit<Serialized, "type">) => Command;
    encodeData: (command: Command) => Omit<Serialized, "type">;
};

function createReversibleCommandCodec<Serialized extends {type: string}, Command>(
    options: ReversibleCommandCodecOptions<Serialized, Command>
) {
    return z.codec(options.serializedSchema, options.commandSchema, {
        decode: ({type: _type, ...data}) => options.decode(data),
        encode: (command) => ({type: options.type, ...options.encodeData(command)})
    });
}
```

The exact generic types may need adjustment against Zod 4's `z.codec` type signatures. Treat the API
shape as the design contract: individual command files should provide `serializedSchema`,
`commandSchema`, `decode`, and `encodeData`, not repeat the codec plumbing.

## Command-by-Command Changes

| Command | Durable serialized data | Runtime-only undo data | Proposed change |
|---------|--------------------------|------------------------|-----------------|
| `CreatePageCommand` | `args.pageName`, `pageUuid` | None | Make `pageUuid` public readonly. Remove `CreatePageCommandState` and `getState()`. Use shared codec helper. |
| `InsertBlockCommand` | `args.parentUuid`, `args.content`, insert options, `blockUuid` | None | Make `blockUuid` public readonly. Remove `InsertBlockCommandState` and `getState()`. Use shared codec helper. |
| `UpdateBlockCommand` | `args.blockUuid`, `args.content` | `originalContent` | Use shared codec helper. Keep `originalContent` private and runtime-only. |
| `DeleteBlockCommand` | `args.blockUuid` | `deletedBlockLocation`, `tempPageUUID` | Use shared codec helper. Keep delete snapshots private and runtime-only. |
| `DeletePageCommand` | `args.pageUuid` | `deletedPage` | Use shared codec helper. Keep `deletedPage` private and runtime-only. |
| `MoveBlockCommand` | `args.srcBlockUuid`, `args.destBlockUuid`, `args.before`, `args.children` | `originalPreviousBlockUuid`, `originalIsPreviousBlockParent` | Use shared codec helper. Keep position snapshot private and runtime-only. |
| `RenamePageCommand` | `args.pageUuid`, `args.newName` | `originalName`, `pageUUID` | Use shared codec helper. Keep original name/page snapshot private and runtime-only. |

## Naming

Rename `*DataSchema` to `*SerializedSchema` as commands are touched.

`DataSchema` is vague. `SerializedSchema` describes its actual role: the JSON-compatible command
shape stored in tracker artifacts.

Recommended names:

| Current | Proposed |
|---------|----------|
| `CreatePageCommandDataSchema` | `CreatePageCommandSerializedSchema` |
| `InsertBlockCommandDataSchema` | `InsertBlockCommandSerializedSchema` |
| `UpdateBlockCommandDataSchema` | `UpdateBlockCommandSerializedSchema` |
| `SerializedLogseqReversibleCommand` | Keep as-is |
| `LogseqReversibleCommand` | Keep as-is |

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

Expected serialized `InsertBlockCommand` when `sibling` default is applied:

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

1. Add or update serializer tests that lock the current JSON shape for every command type, including
   defaulted fields such as `sibling` and `children`.
2. Add `createReversibleCommandCodec` near the command implementations.
3. Convert `CreatePageCommand` first because it has the smallest generated-identifier pattern.
4. Convert `InsertBlockCommand` next and verify defaulted args still serialize as they do today.
5. Convert `UpdateBlockCommand`, `DeleteBlockCommand`, `DeletePageCommand`, `MoveBlockCommand`, and
   `RenamePageCommand` to the shared codec helper.
6. Rename `*DataSchema` to `*SerializedSchema` while touching each file.
7. Add the command-level JSDoc block to each command class as it is touched.
8. Keep all runtime undo snapshots private and out of serialization.
9. Run focused serializer tests after each conversion, then run TypeScript and Biome checks for the
   modified files.

## Acceptance Criteria

- `CreatePageCommand` and `InsertBlockCommand` no longer define `getState()`.
- Generated durable IDs are `public readonly` properties and are encoded directly.
- All command codecs use the shared helper.
- Existing serialized JSON shape is unchanged for all commands.
- Constructor inputs still accept values that rely on Zod defaults.
- Runtime-only snapshots are not serialized.
- `LogseqReversibleCommandCodec` remains a discriminated union over all command codecs.
- Serializer round-trip tests pass.

## Non-Goals

- Do not serialize runtime undo snapshots as part of this refactor.
- Do not change artifact JSON shape.
- Do not add artifact migrations unless a shipped version requires backward compatibility.
- Do not merge all command classes into one generic command type.
- Do not remove command-specific schemas used by tools and JSON schema generation.

## Decision: Do Not Serialize Runtime Undo Snapshots

Runtime undo snapshots should remain in-memory only.

A command instance is typically used in one of two lifecycle patterns:

1. **In-memory:** `execute()` runs, then `revert()` runs within the same in-memory transaction. The
   runtime snapshot is captured and consumed in the same process while the graph is still in the
   expected state.
2. **Replayed after a round trip:** the command is serialized into the artifact, deserialized later,
   and may be `execute()`d long after. Between serialization and replay, the graph may have changed:
   blocks can move, pages can be renamed, content can be edited, and deleted entities can be
   recreated.

Because the second pattern is real but old snapshots are only safe in the first pattern, snapshots
are kept runtime-only and dropped on serialize. After a round trip, `execute()` captures fresh
runtime snapshots from the current graph, so an immediate `execute()` then `revert()` pair remains
supported.

Only durable command identity should be serialized, such as generated `pageUuid` and `blockUuid`
values owned by create-style commands. Execution-time rollback data such as `originalContent`,
`deletedPage`, `deletedBlockLocation`, `tempPageUUID`, and move-position snapshots should stay
private and runtime-only.

## Risks And Follow-Ups

- The helper's generic types may need small adjustments to satisfy Zod 4's codec overloads while
  preserving the proposed API.
- Defaulted schemas need explicit tests because serialized output should reflect parsed `args`, not
  raw constructor input.
- If future requirements need rollback after deserializing an already executed command, that should
  be designed as a separate persisted snapshot format, not added to this cleanup refactor.
