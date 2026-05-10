# Custom Backend Integration

Connect assistant-ui to any backend using useLocalRuntime or useExternalStoreRuntime.

## useLocalRuntime

For backends that return streaming responses. Emit `ChatModelRunResult` chunks (append-only `content` parts).

### Basic Setup

Plain-text streaming only. For AI SDK Data Stream responses, use `toUIMessageStreamResponse()` + `useChatRuntime` or decode with `DataStreamDecoder`.

```tsx
import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

function Chat() {
  const runtime = useLocalRuntime({
    model: {
      async *run({ messages, abortSignal }) {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const textChunk of parts.filter(Boolean)) {
            yield { content: [{ type: "text", text: textChunk }] };
          }
        }

        if (buffer) {
          yield { content: [{ type: "text", text: buffer }] };
        }
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### With SSE Parsing

Simple SSE `data:` lines only (not AI SDK Data Stream prefixes like `0:`/`b:`/`c:`).

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          if (line === "data: [DONE]") return;

          const data = JSON.parse(line.slice(6));
          yield { content: [{ type: "text", text: data.content }] };
        }
      }
    },
  },
});
```

### With Tools

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const toolCalls = new Map<
        string,
        { toolCallId: string; toolName: string; args: unknown; argsText: string }
      >();

      for await (const event of parseResponse(response)) {
        if (event.type === "text") {
          yield { content: [{ type: "text", text: event.content }] };
        }

        if (event.type === "tool_use") {
          const toolCall = {
            toolCallId: event.id,
            toolName: event.name,
            args: event.input ?? {},
            argsText: JSON.stringify(event.input ?? {}),
          };
          toolCalls.set(event.id, toolCall);
          yield { content: [{ type: "tool-call", ...toolCall }] };
        }

        if (event.type === "tool_result") {
          const toolCall = toolCalls.get(event.tool_use_id);
          yield {
            content: [
              {
                type: "tool-call",
                toolCallId: event.tool_use_id,
                toolName: toolCall?.toolName ?? "tool",
                args: toolCall?.args ?? {},
                argsText: toolCall?.argsText ?? "{}",
                result: event.content,
              },
            ],
          };
        }
      }
    },
  },
});
```

## useExternalStoreRuntime

For apps with existing state management (Redux, Zustand, etc.).

### Basic Setup

```tsx
import { useExternalStoreRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

function Chat() {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    onNew: async (message) => {
      const userMessage: ThreadMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message.content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsRunning(true);

      const response = await myAPI.chat([...messages, userMessage]);

      const assistantMessage: ThreadMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: [{ type: "text", text: response.text }],
        status: "complete",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsRunning(false);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### With Redux

```tsx
import { useSelector, useDispatch } from "react-redux";

function Chat() {
  const dispatch = useDispatch();
  const messages = useSelector(selectMessages);
  const isRunning = useSelector(selectIsRunning);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    onNew: async (message) => {
      dispatch(addMessage({ role: "user", content: message.content }));
      dispatch(setRunning(true));

      const response = await chatAPI(messages);

      dispatch(addMessage({ role: "assistant", content: response }));
      dispatch(setRunning(false));
    },
    onReload: async (parentId) => {
      dispatch(reloadFrom(parentId));
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### With Zustand

```tsx
import { create } from "zustand";

const useChatStore = create((set) => ({
  messages: [],
  isRunning: false,
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setRunning: (running) => set({ isRunning: running }),
}));

function Chat() {
  const { messages, isRunning, addMessage, setRunning } = useChatStore();

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    onNew: async (message) => {
      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: message.content,
        createdAt: new Date(),
      });
      setRunning(true);

      const response = await myAPI.chat(messages);

      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: [{ type: "text", text: response }],
        status: "complete",
        createdAt: new Date(),
      });
      setRunning(false);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### Custom Message Format

```tsx
interface MyMessage {
  uuid: string;
  sender: "human" | "ai";
  text: string;
  timestamp: number;
}

const runtime = useExternalStoreRuntime<MyMessage>({
  messages: myMessages,
  isRunning,
  convertMessage: (msg): ThreadMessage => ({
    id: msg.uuid,
    role: msg.sender === "human" ? "user" : "assistant",
    content: [{ type: "text", text: msg.text }],
    status: "complete",
    createdAt: new Date(msg.timestamp),
  }),
  onNew: async (appendMessage) => {
    const text = appendMessage.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

    const myMessage: MyMessage = {
      uuid: crypto.randomUUID(),
      sender: "human",
      text,
      timestamp: Date.now(),
    };

    addMyMessage(myMessage);
  },
});
```

## Streaming Updates with External Store

```tsx
const runtime = useExternalStoreRuntime({
  messages,
  isRunning,
  onNew: async (message) => {
    addUserMessage(message);
    setIsRunning(true);

    const assistantId = crypto.randomUUID();
    addMessage({
      id: assistantId,
      role: "assistant",
      content: [{ type: "text", text: "" }],
      status: "running",
      createdAt: new Date(),
    });

    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    });

    const reader = response.body?.getReader();
    let fullText = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      fullText += new TextDecoder().decode(value);

      updateMessage(assistantId, {
        content: [{ type: "text", text: fullText }],
      });
    }

    updateMessage(assistantId, { status: "complete" });
    setIsRunning(false);
  },
});
```
