# TanStack Router Setup

Setup assistant-ui with Vite + TanStack Router (compatible with React 19).

## Installation

```bash
npm install @assistant-ui/react @tanstack/react-router @tanstack/react-start
npm install vite @vitejs/plugin-react
```

## Vite Configuration

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
```

## Router Setup

```tsx
// src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};
```

## Route with assistant-ui

```tsx
// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Thread } from "@/components/assistant-ui/thread";
import { MyRuntimeProvider } from "@/components/MyRuntimeProvider";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <MyRuntimeProvider>
      <main className="h-dvh">
        <Thread />
      </main>
    </MyRuntimeProvider>
  );
}
```

## Runtime Provider

```tsx
// src/components/MyRuntimeProvider.tsx
import { useState, type ReactNode } from "react";
import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";

type MyMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

const convertMessage = (message: MyMessage): ThreadMessageLike => ({
  id: message.id,
  role: message.role,
  content: [{ type: "text", text: message.content }],
});

export function MyRuntimeProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<MyMessage[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== "text")
      throw new Error("Only text messages are supported");

    const input = message.content[0].text;
    const userMessage: MyMessage = {
      id: generateId(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsRunning(true);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      // Your streaming implementation here
      const stream = await fetchStream([...messages, userMessage]);
      for await (const chunk of stream) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } finally {
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## Key Dependencies

```json
{
  "@assistant-ui/react": "latest",
  "@tanstack/react-router": "^1.162.9",
  "@tanstack/react-start": "^1.162.9",
  "@tailwindcss/vite": "^4.2.1",
  "react": "^19.2.4",
  "vite": "^7.3.1"
}
```

## Notes

- Uses `useExternalStoreRuntime` for custom state management
- Compatible with React 19
- TanStack Start provides SSR/file-based routing
- Tailwind v4 via Vite plugin
