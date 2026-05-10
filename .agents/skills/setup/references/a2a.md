# A2A Protocol Integration

Connect assistant-ui to Agent-to-Agent (A2A) protocol backends for multi-agent systems.

## Installation

```bash
npm install @assistant-ui/react-a2a
```

## Exports

```tsx
import {
  useA2ARuntime,
  useA2AMessages,
  useA2ATaskState,
  useA2AArtifacts,
  useA2ASend,
  convertA2AMessages,
  A2AMessageAccumulator,
  appendA2AChunk,
} from "@assistant-ui/react-a2a";
```

## Basic Setup

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { useA2ARuntime } from "@assistant-ui/react-a2a";

function Chat() {
  const runtime = useA2ARuntime({
    stream: async function* (messages, config) {
      const response = await fetch("/api/a2a", {
        method: "POST",
        body: JSON.stringify({ messages, config }),
      });

      const reader = response.body?.getReader();
      // ... yield A2A events
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## useA2ARuntime Options

```tsx
const runtime = useA2ARuntime({
  stream: A2AStreamCallback,                  // Required: streaming function
  contextId: "thread-id",                     // Optional: thread context ID (deprecated)
  autoCancelPendingToolCalls: true,           // Optional: auto-cancel pending tools
  unstable_allowCancellation: false,          // Optional: enable cancellation
  onSwitchToNewThread: () => {},              // Optional: new thread handler (deprecated)
  onSwitchToThread: async (id) => ({          // Optional: switch thread handler
    messages: [],
    artifacts: [],
  }),
  adapters: {
    attachments: AttachmentAdapter,
    speech: SpeechSynthesisAdapter,
    feedback: FeedbackAdapter,
  },
  eventHandlers: {                            // Optional: A2A event callbacks
    onTaskUpdate: (event) => {},
    onArtifacts: (event) => {},
    onError: (event) => {},
    onStateUpdate: (event) => {},
    onCustomEvent: (event) => {},
  },
});
```

## Accessing A2A State

```tsx
import { useA2ATaskState, useA2AArtifacts, useA2ASend } from "@assistant-ui/react-a2a";

function MyComponent() {
  const taskState = useA2ATaskState();  // Current task state
  const artifacts = useA2AArtifacts();  // Accumulated artifacts
  const send = useA2ASend();            // Send function for manual control

  // Send messages manually
  await send(
    [{ role: "user", content: "Hello" }],
    { contextId: "my-context" }
  );
}
```

## A2A Message Types

```tsx
type A2AMessage = {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | A2AMessageContent[];
  tool_calls?: A2AToolCall[];
  tool_call_id?: string;
  artifacts?: A2AArtifact[];
  status?: MessageStatus;
};

type A2AMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string | { url: string } }
  | { type: "data"; data: any };

type A2AToolCall = {
  id: string;
  name: string;
  args: ReadonlyJSONObject;
  argsText?: string;
};

type A2AArtifact = {
  name: string;
  parts: A2AArtifactPart[];
};
```

## With Cloud Thread Management

For thread persistence, use `useCloudThreadListRuntime`:

```tsx
import { useA2ARuntime } from "@assistant-ui/react-a2a";
import { useCloudThreadListRuntime } from "assistant-cloud/react";

function Chat() {
  const runtime = useA2ARuntime({
    stream: myStreamFunction,
    // Don't use contextId/onSwitchToThread here
  });

  // Use cloud for thread management instead
  const threadListRuntime = useCloudThreadListRuntime({ cloud });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## When to Use A2A

- Multi-agent orchestration systems
- Agents with artifact generation (files, images, etc.)
- Complex task state tracking
- Human-in-the-loop tool execution
