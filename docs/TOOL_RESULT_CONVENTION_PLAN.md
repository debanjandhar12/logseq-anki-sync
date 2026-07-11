# Plan: Enforce Tool Result Convention via ChatToolResponse

## Requirements

1. Every tool must return `{ success: true, ...data }` on success or `{ success: false, error: string }` on error.
2. This convention must be **enforced at compile time**, not just by convention.
3. Tools that need to attach artifacts (e.g. `LogseqReversibleTransactionTracker`) should be able to do so cleanly.
4. `addResult()` calls in custom UI tools must also use the same wrapper.

## Current State

- Every tool defines its own local `type XxxResult = { success: true; ... } | { success: false; error: string }` — duplicated across 22 files.
- `TResult` generic on `BaseChatTool` is unconstrained (`= any`) — no compile-time enforcement.
- Tools return a mix of plain objects and `ToolResponse` instances from `assistant-stream`.
- `addResult` (from `@assistant-ui/core`) accepts `TResult | ToolResponse<TResult>`. Since `ChatToolResponse<TResult>` extends `ToolResponse<TResult>`, it is automatically compatible — no override needed.

## Approach: Subclass ToolResponse

Create `ChatToolResponse<TResult>` that extends `ToolResponse<TResult>`. No static methods — just constructor usage. The subclass exists to enforce the `ToolResult` constraint on `TResult` and provide a distinct type for our tools.

### Step 1: Create `src/chat-app/tools/base/ChatToolResponse.ts`

```typescript
import { ToolResponse, type ToolResponseLike } from "assistant-stream";

export type ToolSuccessResult<TData extends Record<string, unknown> = Record<string, never>> =
    { success: true } & TData;

export type ToolErrorResult = { success: false; error: string };

export type ToolResult<TData extends Record<string, unknown> = Record<string, never>> =
    | ToolSuccessResult<TData>
    | ToolErrorResult;

export class ChatToolResponse<TResult extends ToolResult> extends ToolResponse<TResult> {
    constructor(options: ToolResponseLike<TResult>) {
        super(options);
    }
}
```

### Step 2: Constrain `TResult` in base classes

In `BaseChatTool.ts`, `BaseChatToolWithDefaultUI.ts`, `BaseChatToolWithCustomUI.ts`:

```typescript
// Before
TResult = any

// After
TResult extends ToolResult = ToolResult
```

This means:
- A tool declaring `TResult = ToolResult<{ block: Block }>` is valid.
- A tool declaring `TResult = any` or `TResult = { foo: string }` is a **type error**.
- `execute` must return `ChatToolResponse<TResult>` (or `Promise<...>`).

### Step 3: Force `execute` return type

Change the `execute` signature in base classes:

```typescript
// Before
execute?(args: TArgs, context?: ChatToolExecutionContext): Promise<TResult | ToolResponse<TResult>>;

// After
execute?(args: TArgs, context?: ChatToolExecutionContext): Promise<ChatToolResponse<TResult>>;
```

This forces every tool's `execute` to return `ChatToolResponse<TResult>`. No more plain objects, no more raw `ToolResponse`.

### Step 4: `addResult` compatibility

`addResult` from `@assistant-ui/core` is typed as:

```typescript
addResult: (result: TResult | ToolResponse<TResult>) => void;
```

`ChatToolResponse<TResult>` extends `ToolResponse<TResult>`, so it is **automatically accepted** by `addResult` via Liskov substitution. No override needed.

We cannot further restrict `addResult` to only accept `ChatToolResponse` without overriding the upstream type. Instead, we enforce this by **convention + code review**: all our code only ever passes `ChatToolResponse` instances to `addResult`.

### Step 5: Migrate all 22 tools

For each tool:

1. Remove local `type XxxResult` definition.
2. Replace with `type XxxResult = ToolResult<{ ...specific fields... }>` (or just `ToolResult` if no extra data).
3. Replace `return { success: true, ...data }` with `return new ChatToolResponse({ result: { success: true, ...data } })`.
4. Replace `return { success: false, error: "..." }` with `return new ChatToolResponse({ result: { success: false, error: "..." }, isError: true })`.
5. Replace `return new ToolResponse({ result: { success: true, ... }, artifact })` with `return new ChatToolResponse({ result: { success: true, ... }, artifact })`.
6. Replace `return new ToolResponse({ result: { success: false, error }, isError: true })` with `return new ChatToolResponse({ result: { success: false, error }, isError: true })`.
7. Replace `addResult(new ToolResponse({ ... }))` with `addResult(new ChatToolResponse({ ... }))`.

### Example: LogseqInsertBlockTool (tool with artifact)

```typescript
// Before
type LogseqInsertBlockResult =
    | { success: true; block: LogseqReversibleTransactionResult | undefined }
    | { success: false; error: string };

async execute(...): Promise<LogseqInsertBlockResult | ToolResponse<LogseqInsertBlockResult>> {
    try {
        ...
        return new ToolResponse({
            result: { success: true, block },
            artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
        });
    } catch (err) {
        return { success: false, error: `Failed to ...` };
    }
}

// After
type LogseqInsertBlockResult = ToolResult<{
    block: LogseqReversibleTransactionResult | undefined;
}>;

async execute(...): Promise<ChatToolResponse<LogseqInsertBlockResult>> {
    try {
        ...
        return new ChatToolResponse({
            result: { success: true, block },
            artifact: createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
        });
    } catch (err) {
        return new ChatToolResponse({
            result: { success: false, error: `Failed to ...` },
            isError: true
        });
    }
}
```

### Example: LogseqCommitChangesTool (custom UI with addResult)

```typescript
// Before
addResult(
    new ToolResponse({
        result: { success: false, error: getErrorMessageFromErrObj(error) },
        isError: true
    })
);

// After
addResult(
    new ChatToolResponse({
        result: { success: false, error: getErrorMessageFromErrObj(error) },
        isError: true
    })
);
```

### Example: GetUserInfoTool (simple, no artifact)

```typescript
// Before
type GetUserInfoResult =
    | { success: true; userInfo: AppUserInfo | null }
    | { success: false; error: string };

async execute(): Promise<GetUserInfoResult> {
    try {
        ...
        return { success: true, userInfo };
    } catch (err) {
        return { success: false, error: `Failed to ...` };
    }
}

// After
type GetUserInfoResult = ToolResult<{ userInfo: AppUserInfo | null }>;

async execute(): Promise<ChatToolResponse<GetUserInfoResult>> {
    try {
        ...
        return new ChatToolResponse({ result: { success: true, userInfo } });
    } catch (err) {
        return new ChatToolResponse({
            result: { success: false, error: `Failed to ...` },
            isError: true
        });
    }
}
```

## Files to modify

| File | Change |
|---|---|
| `src/chat-app/tools/base/ChatToolResponse.ts` | **NEW** — subclass + shared types |
| `src/chat-app/tools/base/BaseChatTool.ts` | Constrain `TResult extends ToolResult`, change `execute` return type |
| `src/chat-app/tools/base/BaseChatToolWithDefaultUI.ts` | Constrain `TResult extends ToolResult`, change `execute` return type |
| `src/chat-app/tools/base/BaseChatToolWithCustomUI.ts` | Constrain `TResult extends ToolResult` |
| `src/chat-app/tools/impl/GetUserInfoTool.tsx` | Use `ToolResult` type + `ChatToolResponse` |
| `src/chat-app/tools/impl/LogseqAddPropertyToTagPageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqAddTagToBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqClearChangesTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqCommitChangesTool.tsx` | Same + `addResult` calls |
| `src/chat-app/tools/impl/LogseqCreatePageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqCreateTagPageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqDataScriptQueryTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqDeletePageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqDeletePropertyFromBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqInsertBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqMoveBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqReadBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqRemovePropertyFromTagPageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqRemoveTagFromBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqRenamePageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqRestorePageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqTextSearchTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqUpdateBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqUpsertPropertyPageTool.tsx` | Same |
| `src/chat-app/tools/impl/LogseqUpsertPropertyToBlockTool.tsx` | Same |
| `src/chat-app/tools/impl/SkillTool.tsx` | Same |
| `src/chat-app/tools/index.ts` | Re-export `ChatToolResponse`, `ToolResult`, etc. |

## Verification

1. `npx tsc --noEmit` — type check passes
2. `pnpm test --run` — all tests pass
3. `npm run check src/chat-app/tools/` and `npm run check:fix src/chat-app/tools/` — biome lint/format passes
