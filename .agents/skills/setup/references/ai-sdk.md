# AI SDK v6 Integration

Use this when the app uses `@assistant-ui/react-ai-sdk` and an `/api/chat` route powered by `ai@^6`.

## What Changed in AI SDK v6

Agents trained on older AI SDK versions will use outdated patterns. These are **AI SDK** breaking changes (not assistant-ui changes):

| Concept | Old (v4/v5) | Current (v6) |
|---------|-------------|--------------|
| useChat import | `import { useChat } from "ai/react"` | `import { useChat } from "@ai-sdk/react"` |
| assistant-ui wiring | `useAISDKRuntime(chat)` | `useChatRuntime({ transport })` |
| Message conversion | Pass messages directly to `streamText` | `await convertToModelMessages(messages)` |
| Stream response | `result.toDataStreamResponse()` | `result.toUIMessageStreamResponse()` |
| Tool schema key | `parameters: z.object({...})` | `inputSchema: z.object({...})` |
| Multi-step tools | `maxSteps: n` | `stopWhen: stepCountIs(n)` |

## Standard Setup

**Frontend**:

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";

export function Assistant() {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

**Backend** route (`app/api/chat/route.ts`):

```ts
import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, any>;
  } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system,
    messages: await convertToModelMessages(messages),
    tools: {
      ...frontendTools(tools ?? {}),
      // backend tools here...
    },
  });

  return result.toUIMessageStreamResponse();
}
```

`AssistantChatTransport` (the default transport for `useChatRuntime`) automatically forwards `system` and `tools` from the frontend to the backend:

- **`system`** — set via `useAssistantInstructions()` on the frontend, sent as a string in the request body.
- **`tools`** — registered via `makeAssistantTool()` or `useAssistantTool()` on the frontend, sent as JSON Schema definitions in the request body.
- **`frontendTools()`** — converts those JSON Schema definitions into the AI SDK tool format so `streamText` can use them alongside backend-defined tools.

The route must destructure and use both `system` and `tools` for frontend tool forwarding to work.

## Runtime Options

`useChatRuntime` supports the underlying AI SDK chat options plus assistant-ui extensions like `cloud`, `adapters`, and `toCreateMessage`.

```tsx
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
    headers: { "X-Workspace": "acme" },
    body: { model: "gpt-4o-mini" },
  }),
  messages: [
    { id: "1", role: "assistant", parts: [{ type: "text", text: "Hello! How can I help?" }] },
  ],
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  onError: (error) => {
    console.error(error);
  },
  cloud, // optional AssistantCloud instance
  adapters: {
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
  },
});
```

If you explicitly need non-assistant transport behavior, pass a custom transport:

```tsx
import { DefaultChatTransport } from "ai";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

## Tools (AI SDK v6 shape)

Use `tool({ inputSchema: z.object({...}) })` and `stopWhen: stepCountIs(...)` for multi-step tool loops.

```ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      get_weather: tool({
        description: "Get weather by city",
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ city, temperature: 22, unit: "C" }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

## Frontend Tool UI

Use `makeAssistantToolUI` to render tool calls in the chat. Place the component inside `AssistantRuntimeProvider`.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return <div>Loading weather for {args.city}...</div>;
    }
    return (
      <div className="p-4 rounded bg-blue-50">
        <strong>{result?.city}</strong>: {result?.temperature}°{result?.unit}
      </div>
    );
  },
});

// Register inside the provider tree
<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Using Different Providers

Swap the model in `streamText()` — any `@ai-sdk/*` provider works:

```ts
import { anthropic } from "@ai-sdk/anthropic";
streamText({ model: anthropic("claude-sonnet-4-20250514"), ... });

import { google } from "@ai-sdk/google";
streamText({ model: google("gemini-2.0-flash"), ... });

import { bedrock } from "@ai-sdk/amazon-bedrock";
streamText({ model: bedrock("anthropic.claude-3-sonnet-20240229-v1:0"), ... });
```

## Dynamic Model Selection

Pass the model name from the frontend via `body`, then select the provider on the backend:

```tsx
// Frontend
const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
    body: { model: "gpt-4o-mini" },
  }),
});
```

```ts
// Backend
const { messages, model } = await req.json();

const provider = model.startsWith("claude")
  ? anthropic(model)
  : openai(model);

const result = streamText({
  model: provider,
  messages: await convertToModelMessages(messages),
});
```

## With Cloud Persistence

Pass a `cloud` instance to `useChatRuntime` to enable thread persistence and history. Use `ThreadList` to display saved threads.

```tsx
import { AssistantCloud, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function ChatPage() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat" }),
    cloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

See the [cloud reference](./cloud.md) for authentication and configuration details.

## Troubleshooting

**"Module not found: @ai-sdk/react"**
```bash
npm install @ai-sdk/react
```

**"useChat is not a function"**
Mixing v5 and v6. Remove old imports:
```bash
npm uninstall ai/react  # if present
npm install @ai-sdk/react@latest ai@latest
```

**Streaming stops mid-response**
Check `stopWhen` when using tools - use `stepCountIs(n)` to allow multi-step.

**Tool results not showing**
Ensure you return from tool.execute(), not just mutate state.

## Known Pitfalls

- `convertToModelMessages` is async in AI SDK v6: always `await` it.
- Use `toUIMessageStreamResponse()` for route responses, NOT `toDataStreamResponse()`.
- In v6 tool definitions, use `inputSchema`, NOT `parameters`.
- `stopWhen: stepCountIs(n)` replaces `maxSteps: n` for multi-step tool loops.
- If you replace the transport, use `AssistantChatTransport` unless you intentionally want to disable assistant-tool/system forwarding.
