# AI SDK v6 Migration

Migrate a codebase from AI SDK v4 or v5 to v6. This is a methodical, careful process using agents. Do not rush. Verify everything.

**Covers:** v4.x → v6.x, v5.x → v6.x

**Official docs:** https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0

---

## Critical Rules

1. **NEVER make changes without reading files first** - Always read the full file before editing
2. **NEVER guess** - If unsure, search the codebase or ask the user
3. **ALWAYS verify after changes** - Run type check after each file modification
4. **USE AGENTS for research** - Spawn Explore agents for thorough codebase analysis
5. **TRACK EVERYTHING** - Use TodoWrite to track every file and change
6. **ONE CHANGE AT A TIME** - Make atomic changes, verify, then proceed
7. **REFERENCE THE GUIDE** - The complete migration guide is embedded below - consult it for every change

---

## Phase 1: Deep Research (Use Agents)

**STOP. Do not skip this phase. Thorough research prevents mistakes.**

### 1.1 Spawn Research Agent for AI SDK Patterns

Use Task tool with `subagent_type: "Explore"` and `model: "opus"`:

```
Thoroughly search this codebase for ALL AI SDK usage. Find EVERY instance of:

IMPORTS TO FIND:
- import from "ai"
- import from "@ai-sdk/*"
- import from "@assistant-ui/react-ai-sdk"

PATTERNS TO FIND:
- useChat hook usage
- streamText / generateText calls
- generateObject / streamObject calls
- convertToCoreMessages calls
- CoreMessage / Message types
- maxSteps configuration
- tool definitions (look for parameters:, execute:)
- addToolResult calls
- textEmbedding / textEmbeddingModel
- Experimental_Agent
- toDataStreamResponse

For EACH finding, report:
- Exact file path
- Line numbers
- The actual code snippet
- What v6 change applies to it

Be exhaustive. Missing something causes migration failures.
```

### 1.2 Spawn Research Agent for Package Analysis

Use Task tool with `subagent_type: "Explore"`:

```
Find and analyze all package.json files in this repository.

For each package.json, extract:
1. Current versions of: ai, @ai-sdk/*, zod, @assistant-ui/*
2. The package manager (look for pnpm-lock.yaml, yarn.lock, package-lock.json)
3. Test scripts (test, test:watch, etc.)
4. Build scripts

Report the exact current versions vs required v6 versions.
```

### 1.3 Spawn Research Agent for Test Infrastructure

Use Task tool with `subagent_type: "Explore"`:

```
Find the test infrastructure in this codebase:

1. Test framework (vitest, jest, etc.)
2. Test file locations and patterns
3. Any AI SDK test mocks (MockLanguageModelV2, etc.)
4. The exact command to run tests
5. Any test configuration files
```

### 1.4 Compile Research Results

After ALL agents complete, create a comprehensive findings document:

- Total files requiring changes
- Categorized list of all patterns found
- Package versions needing update
- Test command to use
- Any unusual patterns or edge cases

**CHECKPOINT: Present findings to user. Ask if anything was missed. Do not proceed until confirmed.**

---

## Phase 2: Create Detailed Migration Plan

Based on Phase 1 findings and the migration guide below, create a file-by-file plan.

### 2.1 Categorize Changes

Group findings into categories:

**Category A: Codemod-handled** (automatic)
- CoreMessage → ModelMessage
- convertToCoreMessages → convertToModelMessages
- textEmbedding/textEmbeddingModel → embedding/embeddingModel (on providers)
- ToolCallOptions → ToolExecutionOptions

**Category B: Manual - Simple renames**
- Message → UIMessage
- maxSteps → stopWhen: stepCountIs(n)

**Category C: Manual - Structural changes**
- Adding await to convertToModelMessages
- toDataStreamResponse → toUIMessageStreamResponse
- generateObject → generateText + Output.object
- Tool definition restructuring
- useChat hook changes

**Category D: Manual - Complex logic**
- Message parts array handling
- Custom stream implementations
- Tool result handling changes

### 2.2 Create File-by-File Plan

For EACH file that needs changes, document:

```
FILE: path/to/file.ts
CHANGES NEEDED:
  1. Line X: [old] → [new] (Category: X)
  2. Line Y: [old] → [new] (Category: X)
IMPORTS TO ADD: [list]
IMPORTS TO REMOVE: [list]
VERIFICATION: What to check after editing
```

### 2.3 Determine Execution Order

Order matters. Follow this sequence:

1. Package updates (package.json)
2. Run codemods
3. Type definition files
4. Utility/helper files
5. API routes
6. React components
7. Test files

**CHECKPOINT: Present full plan to user for approval. Do not proceed without explicit approval.**

---

## Phase 3: Execute Migration

**Only proceed after user approves the plan.**

### 3.1 Update Packages

Detect package manager and run appropriate command:

```bash
# For pnpm
pnpm add ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest zod@latest @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest

# For npm
npm install ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest zod@latest

# For yarn
yarn add ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest zod@latest
```

**VERIFY:** Check package.json shows correct versions before continuing.

### 3.2 Run Codemods

```bash
npx @ai-sdk/codemod upgrade
```

This is the recommended approach - it detects your current version and applies all necessary codemods (v4→v5→v6) automatically.

**VERIFY:**
- Review codemod output
- Run `git diff` to see what changed
- Check for any errors or warnings

### 3.3 Apply Manual Changes

**For EACH file in the plan:**

1. Add to todo list as "in_progress"
2. Read the ENTIRE file first
3. Make changes ONE AT A TIME
4. After each change, verify syntax is valid
5. After all changes to file, run type check
6. Mark as "completed" only after type check passes

**IMPORTANT PATTERNS FROM GUIDE:**

API Route changes:
```typescript
// OLD
const result = streamText({ model, messages, maxSteps: 10 });
return (await result).toDataStreamResponse();

// NEW
import { stepCountIs } from "ai";
const result = streamText({
  model,
  messages: await convertToModelMessages(messages),
  stopWhen: stepCountIs(10)
});
return result.toUIMessageStreamResponse();
```

Tool definitions:
```typescript
// OLD
tools: {
  myTool: {
    description: "...",
    parameters: z.object({ ... }),
    execute: async (args) => { ... }
  }
}

// NEW
import { tool, zodSchema } from "ai";
tools: {
  myTool: tool({
    description: "...",
    inputSchema: zodSchema(z.object({ ... })),
    execute: async (args, options) => { ... }
  })
}
```

### 3.4 Type Check After Each File

```bash
npx tsc --noEmit
# or
pnpm type-check
# or whatever the project uses
```

If errors found:
1. Read the error carefully
2. Consult the migration guide below
3. Fix the specific error
4. Re-run type check
5. Repeat until clean

---

## Phase 4: Build Verification

### 4.1 Full Type Check

Run full TypeScript compilation:

```bash
npx tsc --noEmit
```

### 4.2 Fix All Type Errors

For each error:
1. Add to todo list
2. Read the file and surrounding context
3. Identify which v6 change applies
4. Apply the fix from the guide
5. Verify the fix
6. Mark complete

**Common type errors and fixes:**

- `Property 'content' does not exist on type 'UIMessage'` → Use `message.parts` array
- `Type 'CoreMessage' not found` → Change to `ModelMessage`
- `maxSteps does not exist` → Use `stopWhen: stepCountIs(n)`
- `toDataStreamResponse not found` → Use `toUIMessageStreamResponse()`

### 4.3 Build Check

```bash
pnpm build
# or
npm run build
```

Fix any build errors before proceeding.

---

## Phase 5: Test Verification

### 5.1 Run Test Suite

```bash
pnpm test
# or
npm test
```

### 5.2 Fix Failing Tests

For EACH failing test:

1. Read the test file
2. Read the error message carefully
3. Determine if it's a:
   - Test mock issue (V2 → V3)
   - Assertion issue (message structure changed)
   - Implementation issue (missed migration step)
4. Apply appropriate fix
5. Re-run that specific test
6. Verify it passes
7. Move to next failing test

### 5.3 Full Test Pass

Run complete test suite again. All tests must pass.

---

## Phase 6: Final Verification

### 6.1 Manual Testing Checklist

Ask user to verify:

- [ ] Dev server starts without errors
- [ ] Chat messages send successfully
- [ ] Streaming responses work
- [ ] Tool calls execute correctly
- [ ] Tool results display properly
- [ ] No console errors

### 6.2 Cleanup

- Remove any TODO comments added during migration
- Remove unused imports
- Run linter/formatter

---

## Rollback Plan

If migration fails catastrophically:

```bash
git checkout .
git clean -fd
```

Then re-analyze what went wrong before retrying.

---

# COMPLETE MIGRATION GUIDE REFERENCE

**Consult this for EVERY change. Do not guess.**

## Package Updates

### Required Package Versions

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/react": "^3.0.0",
  "@ai-sdk/provider": "^3.0.0",
  "@ai-sdk/provider-utils": "^4.0.0",
  "@assistant-ui/react": "^0.12.14",
  "@assistant-ui/react-ai-sdk": "^1.3.10"
}
```

### Provider Packages

All `@ai-sdk/*` provider packages should be updated to `^3.0.0`:

```json
{
  "@ai-sdk/openai": "^3.0.0",
  "@ai-sdk/anthropic": "^3.0.0",
  "@ai-sdk/google": "^3.0.0",
  "@ai-sdk/mistral": "^3.0.0"
}
```

### MCP Package (if using MCP)

MCP has been moved to a separate package:

```json
{
  "@ai-sdk/mcp": "^1.0.0"
}
```

### Zod Support

AI SDK v6 supports both Zod 3.25+ and Zod 4.x:

```json
{
  "zod": "^3.25.76 || ^4.1.8"
}
```

---

## Automated Migration

The AI SDK provides codemods to automate many migration tasks:

```bash
# From v4: Run ALL codemods (v4 → v5 → v6)
npx @ai-sdk/codemod upgrade

# From v5: Run v6 codemods only (v5 → v6)
npx @ai-sdk/codemod v6

# Run specific codemods
npx @ai-sdk/codemod v6/rename-core-message-to-model-message src/
npx @ai-sdk/codemod v6/add-await-converttomodelmessages src/
npx @ai-sdk/codemod v5/move-maxsteps-to-stopwhen src/
```

**Which command to use:**
- `upgrade` - Recommended for v4 projects. Runs all v4, v5, and v6 codemods.
- `v6` - For v5 projects. Runs only v6 codemods.
- `v5` - For v4 projects wanting incremental migration. Runs only v5 codemods.
- `v4` - For v3 projects. Runs only v4 codemods.

### Available v6 Codemods (v5 → v6)

| Codemod | Description |
|---------|-------------|
| `v6/add-await-converttomodelmessages` | Adds `await` to `convertToModelMessages()` calls |
| `v6/rename-converttocoremessages-to-converttomodelmessages` | Updates the conversion function name |
| `v6/rename-core-message-to-model-message` | Renames `CoreMessage` → `ModelMessage` |
| `v6/rename-mock-v2-to-v3` | Updates test mock classes from V2 to V3 |
| `v6/rename-text-embedding-to-embedding` | Renames `textEmbeddingModel` → `embeddingModel` on providers |
| `v6/rename-tool-call-options-to-tool-execution-options` | Renames `ToolCallOptions` → `ToolExecutionOptions` |
| `v6/rename-vertex-provider-metadata-key` | Updates `google` → `vertex` for metadata keys |

### Key v5 Codemods (v4 → v5, needed for v4 → v6)

| Codemod | Description |
|---------|-------------|
| `v5/move-maxsteps-to-stopwhen` | Moves `maxSteps` to `stopWhen: stepCountIs(n)` |
| `v5/rename-max-tokens-to-max-output-tokens` | Renames `maxTokens` → `maxOutputTokens` |
| `v5/rename-tool-parameters-to-inputschema` | Renames tool `parameters` → `inputSchema` |
| `v5/replace-usechat-api-with-transport` | Replaces `useChat({ api })` with transport |
| `v5/replace-usechat-input-with-state` | Removes managed input state from useChat |
| `v5/replace-content-with-parts` | Replaces `message.content` with `message.parts` |
| `v5/rename-message-to-ui-message` | Renames `Message` → `UIMessage` |
| `v5/rename-datastream-methods-to-uimessage` | Renames stream methods to UI message variants |

**Note:** Review all automated changes manually, especially around async/await additions.

---

## Core Breaking Changes

### 1. Message Type Changes

`CoreMessage` has been replaced with `ModelMessage`:

```diff
- import { CoreMessage, convertToCoreMessages } from "ai";
+ import { ModelMessage, convertToModelMessages } from "ai";
```

`Message` has been replaced with `UIMessage`:

```diff
- import type { Message } from "ai";
+ import type { UIMessage } from "ai";
```

### 2. `convertToModelMessages` is Now Async

This is a critical change that affects all API routes:

```diff
// Before (v5)
- const modelMessages = convertToCoreMessages(messages);

// After (v6) - MUST use await
+ const modelMessages = await convertToModelMessages(messages);
```

### 3. `maxSteps` Replaced with `stopWhen`

```diff
+ import { stepCountIs } from "ai";

const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
- maxSteps: 10,
+ stopWhen: stepCountIs(10),
});
```

### 4. Agent Class Changes

`Experimental_Agent` has been replaced with `ToolLoopAgent`:

```diff
- import { Experimental_Agent } from "ai";
+ import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
- system: "You are a helpful assistant",
+ instructions: "You are a helpful assistant",
  // Note: Default stopWhen changed from stepCountIs(1) to stepCountIs(20)
});
```

### 4.1 Agent Stream Response Renamed

```diff
- import { createAgentStreamResponse } from "ai";
+ import { createAgentUIStreamResponse } from "ai";

- return createAgentStreamResponse({ ... });
+ return createAgentUIStreamResponse({ ... });
```

The `messages` property in the result has been renamed to `uiMessages`:

```diff
- const { messages } = await createAgentUIStreamResponse({ ... });
+ const { uiMessages } = await createAgentUIStreamResponse({ ... });
```

### 5. Tool Call Options Renamed

```diff
- import type { ToolCallOptions } from "ai";
+ import type { ToolExecutionOptions } from "ai";
```

### 6. Embedding Method Renames

Provider embedding methods were renamed:

```diff
- const model = openai.textEmbedding("text-embedding-3-small");
+ const model = openai.embedding("text-embedding-3-small");

// Alternative (also renamed):
- const model = openai.textEmbeddingModel("text-embedding-3-small");
+ const model = openai.embeddingModel("text-embedding-3-small");
```

**Note:** The core `embed()` and `embedMany()` functions from the "ai" package remain unchanged. Only the provider methods were renamed.

### 7. MCP Imports Moved to Separate Package

If you're using MCP (Model Context Protocol), imports have moved from `ai` to `@ai-sdk/mcp`:

```diff
- import { experimental_createMCPClient } from "ai";
- import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
+ import { experimental_createMCPClient } from "@ai-sdk/mcp";
+ import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
```

**Note:** Install the new package: `pnpm add @ai-sdk/mcp`

### 8. Warning Type Unification

Separate warning types consolidated into a single `Warning` type:

```diff
- import type { GenerateTextWarning, StreamTextWarning, CallWarning } from "ai";
+ import type { Warning } from "ai";
```

### 9. Finish Reason Change

The "unknown" finish reason now returns as "other":

```diff
- if (result.finishReason === "unknown") { }
+ if (result.finishReason === "other") { }
```

### 10. Tool UI Helper Renames

The naming changed to distinguish static vs dynamic tools:

```diff
// For static tools only:
- import { isToolUIPart, getToolName } from "ai";
+ import { isStaticToolUIPart, getStaticToolName } from "ai";

// For both static and dynamic tools (the new default):
- import { isToolOrDynamicToolUIPart, getToolOrDynamicToolName } from "ai";
+ import { isToolUIPart, getToolName } from "ai";
```

### 11. Tool.toModelOutput Signature Change

```diff
const myTool = tool({
  // ...
  // Before
- toModelOutput: (output) => processOutput(output),

  // After - requires object destructuring
+ toModelOutput: ({ output }) => processOutput(output),
});
```

### 12. ToolCallRepairFunction Change

The `system` parameter now accepts different types:

```diff
// system parameter type changed
- system: string | undefined
+ system: string | SystemModelMessage | undefined

// Handle both types:
const repair: ToolCallRepairFunction = async ({ system }) => {
  const systemText = typeof system === 'string' ? system : system?.content;
};
```

### 13. Token Usage Property Changes

```diff
// Cached input tokens
- result.usage.cachedInputTokens
+ result.usage.inputTokenDetails.cacheReadTokens

// Reasoning tokens
- result.usage.reasoningTokens
+ result.usage.outputTokenDetails.reasoningTokens
```

### 14. Rerank Score Property Renamed

```diff
// For reranking results
- result.relevanceScore
+ result.score
```

---

## UI & React Changes

### 1. UIMessage Structure

The fundamental message format changed from a single `content` string to a `parts` array:

```typescript
// Old structure (v5)
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// New structure (v6)
interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  metadata?: Record<string, unknown>;
}
```

### 2. Message Part Types

The `parts` array supports multiple content types:

```typescript
type MessagePart =
  | { type: "text"; text: string }
  | { type: "file"; file: FileInfo }
  | { type: "reasoning"; text: string }
  | { type: "tool-invocation"; toolInvocation: ToolInvocation }
  | { type: "source-url"; sourceId: string; url: string; title?: string }
  | { type: "source-document"; sourceId: string; ... }
  | { type: `data-${string}`; data: unknown };  // Custom data parts
```

### 3. Reading Text from Messages

```typescript
// Extract text content from UIMessage
const extractText = (messages: UIMessage[]): string => {
  return messages
    .map((m) =>
      m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
    )
    .join("\n");
};
```

### 4. useChat Hook Changes

The `useChat` hook underwent significant restructuring in v6.

#### Input State Management

Input is **no longer managed internally** by the hook:

```diff
// Before (v5)
- const { input, setInput, handleSubmit } = useChat();
- <input value={input} onChange={(e) => setInput(e.target.value)} />

// After (v6) - manage input state yourself
+ const [input, setInput] = useState("");
+ const { sendMessage } = useChat();
+
+ const handleSubmit = () => {
+   sendMessage(input);
+   setInput("");
+ };
```

#### Message Sending

`append()` replaced with `sendMessage()`:

```diff
// Before (v5)
- append({ role: "user", content: "Hello" });

// After (v6) - multiple valid formats:

// Option 1: Simple string
+ sendMessage("Hello");

// Option 2: Object with text
+ sendMessage({ text: "Hello" });

// Option 3: Object with parts array
+ sendMessage({
+   parts: [{ type: "text", text: "Hello" }]
+ });

// With options (headers, body, metadata)
+ sendMessage("Hello", { metadata: { key: "value" } });
```

#### Tool Result Handling

AI SDK v6 provides two methods for submitting tool results:

```typescript
// addToolResult - Simple form (without explicit state)
addToolResult({
  tool: "toolName",
  toolCallId,
  output: result,
});

// addToolOutput - With explicit state (for success or error)
addToolOutput({
  state: "output-available",
  tool: "toolName",
  toolCallId,
  output: result,
});

// For errors, use addToolOutput with error state:
addToolOutput({
  state: "output-error",
  tool: "toolName",
  toolCallId,
  errorText: "Error message",
});
```

**Note:** Both `addToolResult` and `addToolOutput` are available. Use `addToolOutput` when you need to explicitly set the state (especially for errors).

### 5. Status States

The hook returns a `status` field with four possible values:

```typescript
type ChatStatus = "submitted" | "streaming" | "ready" | "error";

const { status } = useChat();

// submitted: Message sent, awaiting response stream start
// streaming: Response actively receiving data chunks
// ready: Response complete, ready for new messages
// error: Request failed
```

### 6. Transport Configuration

The transport-based architecture replaces the old `api` option:

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

// Before (v5)
const { messages } = useChat({
  api: "/api/chat",
});

// After (v6)
const { messages } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    headers: { /* ... */ },
    body: { /* ... */ },
    credentials: "include",
  }),
});
```

### 7. Message Validation for Persistence

When loading messages from storage that contain tools or custom data, validate them:

```typescript
import { validateUIMessages } from "ai";

// Before using stored messages
const validatedMessages = await validateUIMessages({
  messages: storedMessages,
  tools: yourTools,
});
```

---

## Tool System Changes

**Important:** AI SDK and assistant-ui use different property names for tool schemas:
- **AI SDK `tool()` helper** (backend): uses `inputSchema`
- **assistant-ui `useAssistantTool`** (frontend): uses `parameters`

This distinction matters when defining tools in different contexts.

### 1. Tool Definition with `tool()` Helper

The `tool()` helper provides type inference between schema and execute function:

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get weather for a location",

  // inputSchema accepts Zod schemas directly
  inputSchema: z.object({
    location: z.string().describe("The location to get weather for"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),

  execute: async ({ location, unit }, options) => {
    // options includes: toolCallId, messages, abortSignal
    return { temperature: 72, unit: unit ?? "fahrenheit" };
  },

  // Optional: Enable strict mode for providers that support it
  strict: true,
});
```

### 2. Schema Options

You can use Zod schemas directly (auto-converted) or wrap them with helpers:

```typescript
import { tool, zodSchema, jsonSchema } from "ai";
import { z } from "zod";

// Option 1: Direct Zod (auto-converted to JSON Schema)
const tool1 = tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ },
});

// Option 2: zodSchema() wrapper (explicit, recommended for clarity)
// This is what the assistant-ui examples use
const tool2 = tool({
  inputSchema: zodSchema(
    z.object({ query: z.string() }),
  ),
  execute: async ({ query }) => { /* ... */ },
});

// Option 3: zodSchema() with options (for recursive schemas)
const tool3 = tool({
  inputSchema: zodSchema(
    z.object({ category: categorySchema }),
    { useReferences: true }  // Enables recursive schema support
  ),
  execute: async ({ category }) => { /* ... */ },
});

// Option 4: jsonSchema() for JSON Schema objects
const tool4 = tool({
  inputSchema: jsonSchema<{ query: string }>({
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  }),
  execute: async ({ query }) => { /* ... */ },
});
```

**Note:** When using `.describe()` or `.meta()` on Zod schemas, these methods must be called **last** in the chain, as Zod returns new instances for most operations.

### 3. Per-Tool Strict Mode

Strict JSON schema validation moved from provider options to individual tools:

```diff
const result = streamText({
  model: openai("gpt-4o"),
- providerOptions: {
-   openai: { strictJsonSchema: true },
- },
  tools: {
    myTool: tool({
      inputSchema: schema,
+     strict: true, // Per-tool strict mode
      execute: async (input) => { /* ... */ },
    }),
  },
});
```

### 4. Tool States

Tool invocations now have explicit states:

```typescript
type ToolInvocationState =
  | "input-streaming"   // Arguments being streamed
  | "input-available"   // Arguments complete, not yet executed
  | "output-available"  // Execution complete with result
  | "output-error";     // Execution failed

// Access in message parts:
message.parts.forEach(part => {
  if (isToolUIPart(part)) {
    console.log(part.state);       // One of the above states
    console.log(part.toolCallId);  // Unique ID
    console.log(part.input);       // Tool arguments
    console.log(part.output);      // Result (if output-available)
    console.log(part.errorText);   // Error (if output-error)
  }
});
```

### 5. Tool Input Lifecycle Hooks

Tools now support streaming callbacks:

```typescript
const myTool = tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ },

  // Called when model starts generating arguments
  onInputStart: ({ toolCallId }) => {
    console.log("Tool input started:", toolCallId);
  },

  // Called for each input chunk (streamText only)
  onInputDelta: ({ toolCallId, delta }) => {
    console.log("Input delta:", delta);
  },

  // Called when complete, validated input is available
  onInputAvailable: ({ toolCallId, input }) => {
    console.log("Input ready:", input);
  },
});
```

### 6. Tool Execution Approval

Tools can require user confirmation:

```typescript
// Server: Mark tool as needing approval
const dangerousTool = tool({
  description: "Deletes a file",
  inputSchema: z.object({ path: z.string() }),
  needsApproval: true,  // Requires client approval
  execute: async ({ path }) => { /* ... */ },
});

// Client: Handle approval
const { addToolApprovalResponse } = useChat();

// User approves
addToolApprovalResponse({ toolCallId, approved: true });

// User denies
addToolApprovalResponse({ toolCallId, approved: false });
```

### 7. Frontend Tools Helper (assistant-ui)

When forwarding tools defined in the frontend to your backend:

```typescript
import { frontendTools } from "@assistant-ui/react-ai-sdk";

// In API route
export async function POST(req: Request) {
  const { messages, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    tools: {
      // Wrap frontend tools
      ...frontendTools(tools),
      // Add backend-only tools
      myBackendTool: tool({ /* ... */ }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

---

## Streaming Architecture

### 1. Stream Response Methods

```diff
// Before (v5) - result was a promise
- return (await result).toDataStreamResponse();

// After (v6) - result is not a promise
+ return result.toDataStreamResponse();

// For UI message streams (recommended for assistant-ui):
+ return result.toUIMessageStreamResponse();
```

### 2. toUIMessageStreamResponse Options

```typescript
return result.toUIMessageStreamResponse({
  // Include reasoning tokens (for models that support it)
  sendReasoning: true,

  // Include source citations (for RAG models)
  sendSources: true,

  // Custom ID generator for messages
  generateMessageId: () => crypto.randomUUID(),

  // Attach metadata to message parts
  messageMetadata: { timestamp: Date.now() },

  // Customize error messages sent to client
  getErrorMessage: (error) => `Error: ${error.message}`,

  // Handle completion (good for persistence)
  onFinish: ({ messages, responseMessage }) => {
    // Save to database
  },
});
```

### 3. Stream Protocol Changes

The protocol evolved to lifecycle events with three-phase patterns:

```typescript
// Text streaming uses start/delta/end with unique IDs
{ type: "text-start", id: "text-1" }
{ type: "text-delta", id: "text-1", delta: "Hello" }
{ type: "text-delta", id: "text-1", delta: " world" }
{ type: "text-end", id: "text-1" }

// Tool inputs stream progressively
{ type: "tool-input-start", toolCallId: "call-1" }
{ type: "tool-input-delta", toolCallId: "call-1", delta: '{"loc' }
{ type: "tool-input-end", toolCallId: "call-1" }
```

### 4. Custom Stream Headers

When providing streams from a custom backend, set the required header:

```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "x-vercel-ai-ui-message-stream": "v1",
  },
});
```

### 5. Creating Custom UI Message Streams

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Write text manually
    writer.write({ type: "text-start", id: "text-1" });
    writer.write({ type: "text-delta", id: "text-1", delta: "Hello" });
    writer.write({ type: "text-end", id: "text-1" });

    // Write custom data (persistent - saved in message.parts)
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 72 },
    });

    // Merge another stream
    const result = streamText({ model, messages });
    writer.merge(result.toUIMessageStream());
  },
  onFinish: ({ messages, responseMessage }) => {
    // Handle completion
  },
});

return createUIMessageStreamResponse({ stream });
```

### 6. Custom Data Parts

#### Defining Type-Safe Data Parts

```typescript
// Define your message type with data parts
export type MyUIMessage = UIMessage<
  never,
  {
    weather: { city: string; temp: number; status: "loading" | "ready" };
    notification: { message: string; level: "info" | "warning" | "error" };
  }
>;
```

#### Server: Sending Data Parts

```typescript
const stream = createUIMessageStream<MyUIMessage>({
  execute: ({ writer }) => {
    // Persistent data part (appears in message.parts)
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 72, status: "ready" },
    });

    // Update same part by using same ID
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 75, status: "ready" },
    });
  },
});
```

#### Client: Reading Data Parts

```typescript
// Persistent parts in message.parts
const weatherData = message.parts
  .filter((part) => part.type === "data-weather")
  .map((part) => part.data);

// Transient parts via onData callback (not saved in message history)
const { messages } = useChat<MyUIMessage>({
  onData: (dataPart) => {
    if (dataPart.type === "data-notification") {
      showToast(dataPart.data.message);
    }
  },
});
```

---

## Structured Output Changes

### generateObject and streamObject Deprecated

Use `generateText` and `streamText` with the `Output` helper instead:

```diff
// Before (v5)
- import { generateObject } from "ai";
- const { object } = await generateObject({
-   model: openai("gpt-4o"),
-   schema: z.object({ name: z.string() }),
-   prompt: "Generate a name",
- });

// After (v6)
+ import { generateText, Output } from "ai";
+ const { output } = await generateText({
+   model: openai("gpt-4o"),
+   output: Output.object({
+     schema: z.object({ name: z.string() }),
+   }),
+   prompt: "Generate a name",
+ });
```

### Output Types

```typescript
import { generateText, streamText, Output } from "ai";

// Single object
const { output } = await generateText({
  model,
  output: Output.object({
    schema: z.object({ name: z.string(), age: z.number() }),
    name: "person",        // Optional: helps model understand context
    description: "...",    // Optional: additional guidance
  }),
  prompt: "Generate a person",
});

// Array of objects
const { output } = await generateText({
  model,
  output: Output.array({
    schema: z.object({ name: z.string() }),
  }),
  prompt: "Generate 5 names",
});

// Choice from options
const { output } = await generateText({
  model,
  output: Output.choice({
    options: ["positive", "negative", "neutral"],
  }),
  prompt: "Classify the sentiment",
});

// Plain JSON (no validation)
const { output } = await generateText({
  model,
  output: Output.json(),
  prompt: "Generate JSON data",
});
```

### Streaming Structured Output

```diff
// Before (v5)
- const { partialObjectStream } = streamObject({ ... });
- for await (const partial of partialObjectStream) { }

// After (v6)
+ const result = streamText({
+   model,
+   output: Output.object({ schema }),
+   prompt: "...",
+ });
+ for await (const partial of result.partialOutputStream) { }
```

For arrays, use `elementStream` to get complete elements:

```typescript
const result = streamText({
  model,
  output: Output.array({ schema }),
  prompt: "Generate items",
});

// Each element is complete and validated
for await (const element of result.elementStream) {
  console.log(element); // Fully validated element
}
```

---

## Provider-Specific Changes

### OpenAI

- `strictJsonSchema` now defaults to `true` (was `false`)
- Disable if needed:

```typescript
const result = await generateText({
  model: openai("gpt-4o"),
  providerOptions: {
    openai: { strictJsonSchema: false },
  },
  // ...
});
```

### Azure OpenAI

- Default behavior switches to Responses API
- Use `azure.chat()` for previous Chat Completions API behavior
- Metadata key changed: `openai` → `azure`

```diff
// For Responses API (new default)
const model = azure("gpt-4o");

// For Chat Completions API (previous behavior)
const model = azure.chat("gpt-4o");

// Metadata access
- result.experimental_providerMetadata?.openai
+ result.experimental_providerMetadata?.azure

// Provider options
- providerOptions: { openai: { ... } }
+ providerOptions: { azure: { ... } }
```

### Anthropic

New `structuredOutputMode` option for Claude Sonnet 4.5+:

```typescript
const result = await generateText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  output: Output.object({ schema }),
  providerOptions: {
    anthropic: {
      // Options: 'outputFormat', 'jsonTool', or 'auto' (default)
      structuredOutputMode: "outputFormat",
    },
  },
});
```

### Google Vertex

Metadata and options key changed:

```diff
- providerOptions: { google: { safetySettings: [...] } }
+ providerOptions: { vertex: { safetySettings: [...] } }

- result.experimental_providerMetadata?.google
+ result.experimental_providerMetadata?.vertex
```

---

## assistant-ui Specific Changes

### 1. Simplified Client Setup

The simplest case works with zero configuration:

```typescript
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

export function Chat() {
  // Defaults to AssistantChatTransport with /api/chat endpoint
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Your chat UI */}
    </AssistantRuntimeProvider>
  );
}
```

### 2. Custom Endpoint Configuration

For custom API endpoints:

```typescript
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

// Option 1: AssistantChatTransport (recommended)
// Automatically forwards system messages and tools from context
const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/my-custom-api/chat",
  }),
});
```

For standard AI SDK transport without automatic forwarding:

```typescript
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";

// Option 2: DefaultChatTransport (from "ai" package)
// Does NOT auto-forward system/tools
const runtime = useChatRuntime({
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
});
```

### 3. Transport Types Summary

| Transport | Package | Auto-Forwards | Use Case |
|-----------|---------|---------------|----------|
| `AssistantChatTransport` | `@assistant-ui/react-ai-sdk` | Yes (system, tools, callSettings) | Default, recommended |
| `DefaultChatTransport` | `ai` | No | Standard AI SDK usage |
| `DirectChatTransport` | `ai` | No | SSR/testing with direct agent |
| `TextStreamChatTransport` | `ai` | No | Plain text backends |

### 4. What AssistantChatTransport Forwards

When using `AssistantChatTransport`, the following are automatically sent to your backend:

```typescript
// Your backend receives in req.body:
{
  messages: UIMessage[],     // Conversation messages
  system: string,            // System prompt from context
  tools: Record<string, {...}>,  // Frontend tools (as JSON schema)
  callSettings: {...},       // Call settings from context
  id: string,                // Thread ID
  trigger: string,           // What triggered the request
  messageId: string,         // Message ID
  metadata: {...},           // Request metadata
}
```

### 5. Exports from @assistant-ui/react-ai-sdk

```typescript
import {
  // Hooks
  useChatRuntime,
  useAISDKRuntime,

  // Transports
  AssistantChatTransport,

  // Helpers
  frontendTools,

  // Types
  type UseChatRuntimeOptions,
} from "@assistant-ui/react-ai-sdk";
```

---

## Complete Migration Examples

### API Route (Full Example)

**Before (AI SDK v5):**
```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    maxSteps: 10,
  });

  return (await result).toDataStreamResponse();
}
```

**After (AI SDK v6):**
```typescript
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  tool,
  zodSchema,
} from "ai";
import type { UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      get_weather: tool({
        description: "Get the current weather",
        inputSchema: zodSchema(
          z.object({
            city: z.string(),
          }),
        ),
        execute: async ({ city }) => {
          return `The weather in ${city} is sunny`;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### API Route with Frontend Tools

```typescript
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  tool,
  zodSchema,
} from "ai";
import type { UIMessage } from "ai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools: clientTools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: any }>;
  } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      // Frontend tools forwarded from client
      ...frontendTools(clientTools ?? {}),
      // Backend-only tools
      search_database: tool({
        description: "Search the database",
        inputSchema: zodSchema(
          z.object({
            query: z.string(),
          }),
        ),
        execute: async ({ query }) => {
          // Server-side only logic
          return { results: [] };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Custom Stream with Data Parts

**Before (v5):**
```typescript
import { createDataStreamResponse, streamText } from "ai";

return createDataStreamResponse({
  execute: async (writer) => {
    writer.writeMessageAnnotation({
      type: "custom-metadata",
      timestamp: Date.now(),
    });

    const result = streamText({ model, messages });
    result.mergeIntoDataStream(writer);
  },
});
```

**After (v6):**
```typescript
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Custom data part
    writer.write({
      type: "data-metadata",
      id: "meta-1",
      data: { timestamp: Date.now() },
    });

    // Merge model response
    const result = streamText({ model, messages: await convertToModelMessages(messages) });
    writer.merge(result.toUIMessageStream());
  },
  onFinish: ({ messages, responseMessage }) => {
    // Persist to database
  },
});

return createUIMessageStreamResponse({ stream });
```

### Client Component with Tools

```typescript
"use client";

import { AssistantRuntimeProvider, useAssistantTool } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { z } from "zod";

function WeatherTool() {
  useAssistantTool({
    toolName: "get_weather",
    description: "Get current weather for a location",
    parameters: z.object({
      location: z.string(),
    }),
    execute: async ({ location }) => {
      // Client-side execution
      const response = await fetch(`/api/weather?location=${location}`);
      return response.json();
    },
    render: ({ args, result, status }) => {
      if (status === "running") return <div>Loading weather...</div>;
      if (result) return <WeatherCard data={result} />;
      return null;
    },
  });

  return null;
}

export function Chat() {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherTool />
      {/* Your chat UI */}
    </AssistantRuntimeProvider>
  );
}
```

---

## Environment Configuration

### Disable Warning Logging

The new warning logger outputs deprecation warnings by default. Disable with:

```bash
export AI_SDK_LOG_WARNINGS=false
```

---

## Test Utilities

V2 mock classes have been removed. Migrate to V3 equivalents:

```diff
- import { MockLanguageModelV2 } from "ai/test";
+ import { MockLanguageModelV3 } from "ai/test";

- import { MockEmbeddingModelV2 } from "ai/test";
+ import { MockEmbeddingModelV3 } from "ai/test";

- import { MockProviderV2 } from "ai/test";
+ import { MockProviderV3 } from "ai/test";
```

---

## New Utilities in v6

These are new helper functions added in v6 (not breaking changes, but useful):

```typescript
import {
  // Message management
  pruneMessages,           // Helper to prune message history by token count
  safeValidateUIMessages,  // Validates UI messages without throwing

  // Type guards
  isDataUIPart,            // Type guard for data parts

  // Model middleware
  wrapEmbeddingModel,      // Wrap embedding model with middleware
} from "ai";
```

---

## v4-Specific Changes (v4 → v6 Direct Migration)

If migrating directly from v4 (skipping v5), apply these additional changes:

### Parameter Renames

```diff
- maxTokens: 1024,
+ maxOutputTokens: 1024,

- providerMetadata: { openai: { store: false } },
+ providerOptions: { openai: { store: false } },
```

### useChat Hook Overhaul

Input state is no longer managed by the hook:

```diff
// v4
- const { input, handleInputChange, handleSubmit } = useChat();

// v6
+ const [input, setInput] = useState("");
+ const { sendMessage } = useChat({
+   transport: new DefaultChatTransport({ api: "/api/chat" }),
+ });
+
+ const handleSubmit = (e) => {
+   e.preventDefault();
+   sendMessage({ text: input });
+   setInput("");
+ };
```

### append → sendMessage

```diff
// v4
- append({ role: "user", content: "Hello" });

// v6
+ sendMessage({ text: "Hello" });
// Or with parts:
+ sendMessage({ parts: [{ type: "text", text: "Hello" }] });
```

### Tool Input/Output Properties

```diff
// v4
- part.args    // Tool input
- part.result  // Tool output

// v6
+ part.input   // Tool input
+ part.output  // Tool output
```

### File Part Changes

```diff
// v4
- part.mimeType
- part.data

// v6
+ part.mediaType
+ part.url
```

### useAssistant Hook Removed

The `useAssistant` hook has been removed entirely. Use `useChat` with appropriate configuration instead.

### Package Imports Changed

```diff
// v4
- import { useChat } from "ai/react";

// v6
+ import { useChat } from "@ai-sdk/react";
// Or for assistant-ui:
+ import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
```

### Codemods for v4

Run both v5 and v6 codemods:

```bash
npx @ai-sdk/codemod upgrade  # Runs all codemods (v4→v5→v6)
# OR
npx @ai-sdk/codemod v5       # v4→v5 only
npx @ai-sdk/codemod v6       # v5→v6 only
```

---

## Migration Checklist

### Package Updates
- [ ] Update `ai` to `^6.0.0`
- [ ] Update `@ai-sdk/react` to `^3.0.0`
- [ ] Update `@ai-sdk/provider` to `^3.0.0`
- [ ] Update `@ai-sdk/provider-utils` to `^4.0.0`
- [ ] Update all `@ai-sdk/*` provider packages to `^3.0.0`
- [ ] Update `zod` to `^3.25.76` or `^4.1.8` (both supported)
- [ ] Update `@assistant-ui/react` to `^0.12.14`
- [ ] Update `@assistant-ui/react-ai-sdk` to `^1.3.10`
- [ ] If using MCP: Install `@ai-sdk/mcp` to `^1.0.0`

### Automated Migration
- [ ] Run `npx @ai-sdk/codemod v6` (from v5)
- [ ] OR run `npx @ai-sdk/codemod upgrade` (from v4, runs all)
- [ ] Review all automated changes manually

### Core Changes
- [ ] Replace `CoreMessage` with `ModelMessage`
- [ ] Replace `convertToCoreMessages` with `convertToModelMessages`
- [ ] Add `await` to all `convertToModelMessages()` calls
- [ ] Replace `maxSteps` with `stopWhen: stepCountIs(n)`
- [ ] Update `generateObject`/`streamObject` to use `generateText`/`streamText` with `Output`
- [ ] Rename `ToolCallOptions` to `ToolExecutionOptions`
- [ ] Update embedding provider methods (`textEmbedding`/`textEmbeddingModel` → `embedding`/`embeddingModel`)
- [ ] Update tool UI helpers (`isToolUIPart` → `isStaticToolUIPart` for static tools)
- [ ] Update `Tool.toModelOutput` signature to use destructuring
- [ ] Update token usage property access paths
- [ ] Handle new "other" finish reason (was "unknown")
- [ ] Update rerank results: `relevanceScore` → `score`
- [ ] If using MCP: Update imports from `ai` to `@ai-sdk/mcp`
- [ ] If using Agent: Rename `createAgentStreamResponse` → `createAgentUIStreamResponse`
- [ ] If using Agent: Rename `messages` → `uiMessages` in agent stream results

### UI & React Changes
- [ ] Update message handling for `parts` array structure
- [ ] Manage input state manually with useChat
- [ ] Replace `append()` with `sendMessage()`
- [ ] Update tool result handling: use `addToolResult({ tool, toolCallId, output })` or `addToolOutput` with state
- [ ] Handle new status states (submitted, streaming, ready, error)
- [ ] Update to transport-based configuration

### Streaming Changes
- [ ] Update stream response: `result.toUIMessageStreamResponse()` (not awaited)
- [ ] Use custom data parts with `type: "data-*"` pattern
- [ ] Add `x-vercel-ai-ui-message-stream: v1` header for custom backends
- [ ] Implement `onFinish` for message persistence

### Tool Changes
- [ ] Use `tool()` helper for backend tool definitions
- [ ] Use Zod schemas in `inputSchema` (directly or with `zodSchema()` wrapper)
- [ ] Use `frontendTools()` helper for forwarding frontend tools
- [ ] Move `strictJsonSchema` to per-tool `strict` property
- [ ] Update tool execute signatures for `ToolExecutionOptions`
- [ ] Handle new tool states: `input-streaming`, `input-available`, `output-available`, `output-error`
- [ ] Place `.describe()` and `.meta()` calls last in Zod schema chains

### Structured Output
- [ ] Replace `generateObject` with `generateText` + `Output.object()`
- [ ] Replace `streamObject` with `streamText` + `Output.object()`
- [ ] Use `partialOutputStream` instead of `partialObjectStream`
- [ ] Use `elementStream` for streaming arrays

### assistant-ui Specific
- [ ] Simplify client: `useChatRuntime()` works with no config for `/api/chat`
- [ ] Use `AssistantChatTransport` (from @assistant-ui/react-ai-sdk) for custom endpoints
- [ ] Import `DefaultChatTransport` from "ai" package (not assistant-ui)

### Provider-Specific
- [ ] Handle OpenAI `strictJsonSchema` default change (now `true`)
- [ ] Update Azure metadata key from `openai` to `azure`
- [ ] Update Vertex metadata key from `google` to `vertex`
- [ ] Configure Anthropic `structuredOutputMode` if needed

### Testing
- [ ] Update mock classes from V2 to V3
- [ ] Test all streaming functionality
- [ ] Verify tool execution with new states
- [ ] Test custom data parts
