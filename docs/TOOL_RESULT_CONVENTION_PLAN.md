# Plan: Enforce the Tool Result Convention

## Decision

Introduce a project-owned `ChatToolResponse<TResult>` that extends
`assistant-stream`'s `ToolResponse<TResult>`. All executable chat tools return this wrapper through
`success()` and `error()` factories.

## Requirements

1. A successful result has `{success: true, ...data}`.
2. A failed result has `{success: false, error: string}`.
3. Successful responses always have `isError === false`; failed responses always have
   `isError === true`.
4. Tool implementations cannot directly construct the project wrapper.
5. Artifacts remain supported.
6. Custom UI submissions use the same factories.
7. Failures synthesized by the local tool executor follow the same result shape.

## Important Limits

- TypeScript cannot reject deliberately unsafe `any` values or type assertions. Constraining the
  generics and return types enforces the convention for normally typed code, not hostile escapes.
- The upstream `addResult` type accepts either a plain `TResult` or `ToolResponse<TResult>`. Our base
  classes cannot narrow that callback type. Custom UI calls therefore need migration plus a
  regression search or lint rule; inheritance alone cannot enforce requirement 6.
- Merely constraining `TResult extends ToolResult` does not make `TResult = any` a type error because
  `any` satisfies generic constraints. Remove all explicit/default `any` uses in project base types
  and verify none remain.

## Shared Types And Wrapper

Create `src/chat-app/tools/base/ChatToolResponse.ts`:

```typescript
import {ToolResponse, type ToolResponseLike} from "assistant-stream";
import type {ReadonlyJSONValue} from "assistant-stream/utils/json/json-value";

export type ToolSuccessResult<
    TData extends Record<string, unknown> = Record<string, never>
> = {success: true} & TData;

export type ToolErrorResult = {success: false; error: string};

export type ToolResult<
    TData extends Record<string, unknown> = Record<string, never>
> = ToolSuccessResult<TData> | ToolErrorResult;

type SuccessData<TData extends Record<string, unknown>> = TData & {
    success?: never;
    error?: never;
};

export class ChatToolResponse<TResult extends ToolResult> extends ToolResponse<TResult> {
    private constructor(options: ToolResponseLike<TResult>) {
        super(options);
    }

    static success(): ChatToolResponse<ToolSuccessResult>;
    static success<TData extends Record<string, unknown>>(
        data: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ToolSuccessResult<TData>>;
    static success<TData extends Record<string, unknown>>(
        data?: SuccessData<TData>,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ToolSuccessResult<TData>> {
        const result = {...data, success: true as const} as ToolSuccessResult<TData>;
        return new ChatToolResponse<ToolSuccessResult<TData>>({result, artifact});
    }

    static error(
        error: string,
        artifact?: ReadonlyJSONValue
    ): ChatToolResponse<ToolErrorResult> {
        return new ChatToolResponse<ToolErrorResult>({
            result: {success: false, error},
            artifact,
            isError: true
        });
    }
}
```

Key details:

- Spread `data` before `success` so runtime input cannot overwrite the discriminator.
- Reject `success` and `error` in success data at compile time to keep those fields owned by the
  factories.
- Rely on `ToolResponse`'s default `isError: false` for success; set it explicitly for errors.
- Keep the constructor private so project code must use the factories.
- Avoid `as any` in the implementation. Confirm the exact `ReadonlyJSONValue` import against the
  installed `assistant-stream` package exports during implementation.

## Base Class Changes

Update all three base classes:

```typescript
TResult extends ToolResult = ToolResult
```

For executable tools, use:

```typescript
execute?(
    args: TArgs,
    context?: ChatToolExecutionContext
): Promise<ChatToolResponse<TResult>>;
```

`BaseChatToolWithDefaultUI.execute` must use the same signature. `BaseChatToolWithCustomUI` only
needs the constrained generic because human tools may intentionally omit `execute`.

Keep `getDefinition(): Tool<TArgs, TResult>` unchanged. A `ChatToolResponse<TResult>` is already
accepted by the upstream `Tool` contract because it extends `ToolResponse<TResult>`.

## Migration

Discover the migration set from the code instead of relying on a fixed count:

1. Search `src/chat-app/tools` for local result unions containing `success: true`.
2. Search for `new ToolResponse`, `ToolResponse.toResponse`, plain `return {success:`, and
   `addResult(`.
3. Search base classes and tool declarations for unconstrained `TResult`, `TResult = any`, and
   `Promise<... | ToolResponse<...>>`.

For each tool:

1. Replace its duplicated union with `ToolResult<TData>`, or `ToolResult` when success has no data.
2. Return `ChatToolResponse.success(data, artifact?)` on success.
3. Return `ChatToolResponse.error(message, artifact?)` on failure.
4. Change helper methods such as `executeApprove()` and `executeCancel()` too; they do not override
   `BaseChatTool.execute`, so the base signature cannot enforce them.
5. Pass the wrapper directly to `addResult`. Remove redundant `ToolResponse.toResponse(...)` calls.
6. Remove obsolete `ToolResponse` imports.

Example:

```typescript
type LogseqInsertBlockResult = ToolResult<{
    block: LogseqReversibleTransactionResult | undefined;
}>;

async execute(...): Promise<ChatToolResponse<LogseqInsertBlockResult>> {
    try {
        // ...
        return ChatToolResponse.success(
            {block},
            createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
        );
    } catch (error) {
        return ChatToolResponse.error(`Failed to insert block: ${getErrorMessageFromErrObj(error)}`);
    }
}
```

For custom UI:

```typescript
addResult(ChatToolResponse.error(getErrorMessageFromErrObj(error)));
```

Re-export `ChatToolResponse`, `ToolResult`, `ToolSuccessResult`, and `ToolErrorResult` from the
tools barrel only if consumers already conventionally import base types from that barrel. Otherwise,
prefer direct base-module imports and avoid creating a circular dependency between base classes.

## Local Executor Consistency

Update `src/chat-app/runtime/LocalChatModelAdapter/tool-execution.ts` so both executor-generated
failure paths produce `{success: false, error}` with `isError: true`:

- A tool definition has no `execute` function.
- Tool execution throws before returning a response.

The executor may use `ChatToolResponse.error(...)` and map its fields to the message part. Keep
`ToolResponse.toResponse(output)` for the generic upstream boundary unless the tool type at that
location can be narrowed without a cast.

## Tests

Add focused unit and compile-time coverage for the shared wrapper:

1. `success()` returns `{success: true}`, preserves data/artifact, and has `isError === false`.
2. `error()` returns `{success: false, error}`, preserves an optional artifact, and has
   `isError === true`.
3. Success data cannot supply `success` or `error` (`@ts-expect-error` assertions or the project's
   existing type-test mechanism).
4. A base tool returning a plain result or raw `ToolResponse` fails type checking.
5. Local executor synthesized failures contain `success: false`.

Do not add a runtime test whose only assertion is that the private constructor is inaccessible;
that is a compile-time property.

## Verification

1. Run targeted tests for the wrapper and local executor.
2. Run `npx tsc --noEmit`.
3. Run `pnpm test --run` (the Logseq proxy-dependent suite requires its API server).
4. Run `npm run check <modified files>`.
5. Run `npm run check:fix <modified files>`, then rerun the check and type check.
6. Search again for `new ToolResponse`, `ToolResponse.toResponse`, plain `return {success:`, result
   union duplication, and custom UI `addResult` calls; inspect any intentional remaining matches.

## Acceptance Criteria

- Every project tool result type extends `ToolResult` without an `any` default.
- Every executable project tool returns `ChatToolResponse<TResult>` through a factory.
- Every custom UI result submission passes a `ChatToolResponse`.
- The result discriminator and `isError` agree in unit tests.
- Adapter-generated tool failures use the same error result convention.
- Type checking, applicable tests, and Biome checks pass.
