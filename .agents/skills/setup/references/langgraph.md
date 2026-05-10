# LangGraph Setup

Integration with LangGraph Python agents.

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-langgraph
```

## Basic Setup

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

function Chat() {
  const runtime = useLangGraphRuntime({
    threadId: "my-thread-id",
    stream: async function* (messages, config) {
      const response = await fetch("/api/langgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, config }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Parse LangGraph events and yield
        for (const event of parseLangGraphEvents(chunk)) {
          yield event;
        }
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## With LangGraph Client SDK

```tsx
import { Client } from "@langchain/langgraph-sdk";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

const client = new Client({
  apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:8123",
});

function Chat() {
  const [threadId, setThreadId] = useState<string | null>(null);

  const runtime = useLangGraphRuntime({
    threadId,
    stream: async function* (messages, config) {
      // Create thread if needed
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const thread = await client.threads.create();
        currentThreadId = thread.thread_id;
        setThreadId(currentThreadId);
      }

      // Stream from LangGraph
      const stream = client.runs.stream(
        currentThreadId,
        "my-assistant",  // Assistant name in LangGraph
        {
          input: { messages },
          config,
        }
      );

      for await (const event of stream) {
        yield event;
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## useLangGraphRuntime Options

```tsx
const runtime = useLangGraphRuntime({
  // Thread identifier
  threadId: string | undefined,

  // Streaming function (required)
  stream: async function* (
    messages: ThreadMessage[],
    config: LangGraphConfig
  ): AsyncGenerator<LangGraphEvent>,

  // Message conversion (optional)
  convertMessage?: (message: ThreadMessage) => LangGraphMessage,

  // Adapters (optional)
  adapters?: {
    attachments?: AttachmentAdapter,
    feedback?: FeedbackAdapter,
  },
});
```

## LangGraph Event Types

The stream callback should yield append-only content updates (same shape as `ChatModelRunResult` content parts). Common cases:

- Text: `{ content: [{ type: "text", text: "partial text" }] }`
- Tool call start/result (single part): `{ content: [{ type: "tool-call", toolCallId, toolName, args, argsText, result? }] }`

## With Tool UI

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

// LangGraph tools can have custom UI
const SearchToolUI = makeAssistantToolUI({
  toolName: "tavily_search",
  render: ({ args, result, status }) => {
    if (status === "running") {
      return <div>Searching for: {args.query}...</div>;
    }
    return (
      <div>
        {result?.results?.map((r: any) => (
          <a key={r.url} href={r.url}>{r.title}</a>
        ))}
      </div>
    );
  },
});
```

## Python Backend Example

```python
# langgraph_server.py
from langgraph.graph import StateGraph, MessagesState
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")

def chat_node(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}

graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.set_entry_point("chat")
graph.set_finish_point("chat")

app = graph.compile()

# Run with: langgraph serve
```

## Thread Persistence

LangGraph handles thread persistence server-side. The `threadId` you pass to the runtime maps to LangGraph's thread management.

```tsx
// Thread list with LangGraph
function ThreadSelector() {
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    client.threads.list().then(setThreads);
  }, []);

  return (
    <select onChange={(e) => setThreadId(e.target.value)}>
      {threads.map((t) => (
        <option key={t.thread_id} value={t.thread_id}>
          {t.thread_id}
        </option>
      ))}
    </select>
  );
}
```

## Troubleshooting

**"Stream not yielding events"**
Ensure your stream function yields events in the correct format. Debug by logging events before yielding.

**"Thread not persisting"**
LangGraph persistence is server-side. Check that your LangGraph server is configured with a checkpointer.

**"Tool calls not rendering"**
Tool names must match between LangGraph and `makeAssistantToolUI`.
