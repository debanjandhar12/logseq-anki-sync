# Breaking Changes Quick Reference

Fast lookup for breaking changes by version.

## By Version

| Version | Breaking Change | Migration |
|---------|-----------------|-----------|
| **0.11.0** | Runtime rearchitecture | Use `useAui`, `useAuiState`, `useAuiEvent` |
| **0.10.0** | CommonJS dropped | Use ESM, set `"type": "module"` |
| **0.8.18** | `setResult`/`setArtifact` merged | Use `setResponse({ result, artifact })` |
| **0.8.0** | UI moved out of core | Use shadcn registry (recommended) or primitives |
| **0.7.44** | `runtime.switchToThread()` moved | Use `runtime.threads.switchToThread()` |
| **0.7.44** | `runtime.threadList` renamed | Use `runtime.threads` |
| **0.7.0** | Deprecated features dropped | Update to non-deprecated APIs |
| **0.5.74** | `maxToolRoundtrips` renamed | Use `maxSteps` |
| **0.4.0** | `AssistantMessage` renamed | Use `ThreadAssistantMessage` |
| **0.4.0** | `UserMessage` renamed | Use `ThreadUserMessage` |
| **0.3.0** | `Message.InProgress` dropped | Use message status |
| **0.2.0** | `MessagePartText` renders as `<p>` | Adjust CSS |

## By Pattern

### Import Changes

```diff
# Styled components (0.8.0+) - use shadcn registry (recommended)
- import { Thread } from "@assistant-ui/react";
+ import { Thread } from "@/components/assistant-ui/thread";
# Note: Run `npx assistant-ui add thread` to install

# Message types (0.4.0+)
- import type { AssistantMessage, UserMessage } from "@assistant-ui/react";
+ import type { ThreadAssistantMessage, ThreadUserMessage } from "@assistant-ui/react";

# AI SDK v6 (react-ai-sdk 1.0+)
- import { useChat } from "ai/react";
- import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
+ import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
```

### API Changes

```diff
# Thread switching (0.7.44+)
- runtime.switchToThread(id);
- runtime.switchToNewThread();
- runtime.threadList
+ runtime.threads.switchToThread(id);
+ runtime.threads.switchToNewThread();
+ runtime.threads

# Tool response (0.8.18+)
- tool.setResult(result);
- tool.setArtifact(artifact);
+ tool.setResponse({ result, artifact });

# State access (0.11.0+)
- const { messages } = useThread();
+ const messages = useAuiState(s => s.thread.messages);

# Actions (0.11.0+)
- useThreadActions().append(...)
+ useAui().thread().append(...)
```

### Config Changes

```diff
# Tool steps (0.5.74+)
- maxToolRoundtrips: 5,
+ maxSteps: 5,
```

## Search Commands

Find code needing updates:

```bash
# All breaking patterns
grep -rn "runtime\.switchToThread\|runtime\.threadList\|AssistantMessage[^C]\|UserMessage[^C]\|setResult\|setArtifact\|maxToolRoundtrips" --include="*.tsx" --include="*.ts"

# Specific version checks
grep -rn "from ['\"]@assistant-ui/react['\"]" --include="*.tsx" | grep -v Primitive  # 0.8.0
grep -rn "Message\.InProgress" --include="*.tsx"  # 0.3.0
```

## AI SDK v6 Changes (Separate)

See [./ai-sdk-v6.md](./ai-sdk-v6.md) for AI SDK specific migrations:

| Old | New |
|-----|-----|
| `maxSteps` | `stopWhen: stepCountIs(n)` |
| `parameters` | `inputSchema` (in `tool()`) |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `generateObject()` | `generateText() + Output.object()` |
| `CoreMessage` | `ModelMessage` |
| `Message` | `UIMessage` |

## Version Compatibility

| @assistant-ui/react | react-ai-sdk | AI SDK | Zod |
|---------------------|--------------|--------|-----|
| 0.12.x | 1.3.x | 6.x | 4.x |
| 0.11.x | 1.2.x | 6.x | 3.25+ or 4.x |
| 0.10.x | 0.x | 4.x-5.x | 3.x |
| 0.8.x-0.9.x | 0.x | 4.x | 3.x |
| < 0.8.0 | 0.x | 4.x | 3.x |
