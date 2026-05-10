# Thread List Management

CRUD operations for managing multiple chat threads.

## Overview

Thread list management allows users to:
- Create new conversations
- Switch between threads
- Rename, archive, and delete threads
- View thread history

## Accessing Thread List API

```tsx
import { useAui, useAuiState } from "@assistant-ui/react";

function ThreadManager() {
  const api = useAui();

  // Get thread list API
  const threads = api.threads();

  // Get current state
  const { threadIds, mainThreadId } = useAuiState(
    (s) => ({
      threadIds: s.threads.threadIds,
      mainThreadId: s.threads.mainThreadId,
    })
  );
}
```

## Thread Operations

### Create New Thread

```tsx
const api = useAui();

// Switch to a new empty thread
await api.threads().switchToNewThread();

// Thread is created when first message is sent
```

### Switch Thread

```tsx
// By thread ID
await api.threads().switchToThread(threadId);

// Using item
const item = api.threads().item({ id: threadId });
await item.switchTo();
```

### Rename Thread

```tsx
const item = api.threads().item({ id: threadId });
await item.rename("New Chat Title");
```

### Archive Thread

```tsx
const item = api.threads().item({ id: threadId });
await item.archive();

// Archived threads move to archivedThreads list
```

### Unarchive Thread

```tsx
const item = api.threads().item({ id: threadId });
await item.unarchive();

// Moves back to regular threads list
```

### Delete Thread

```tsx
const item = api.threads().item({ id: threadId });
await item.delete();

// Permanently removes thread
// If deleting current thread, switches to another
```

### Generate Title

```tsx
const item = api.threads().item({ id: threadId });
await item.generateTitle();

// Uses AI to generate title from conversation
```

## Thread List State

```typescript
interface ThreadListState {
  mainThreadId: string;           // Current thread
  newThreadId: string | null;     // Pending new thread
  threadIds: readonly string[];   // Regular thread IDs
  archivedThreadIds: readonly string[];
  isLoading: boolean;
  threadItems: readonly ThreadListItemState[];
}

interface ThreadListItemState {
  id: string;
  title?: string;
  remoteId?: string;
  externalId?: string;
  status: "archived" | "regular" | "new" | "deleted";
}
```

## Subscribing to Changes

```tsx
import { useAuiState, useAuiEvent } from "@assistant-ui/react";

function ThreadWatcher() {
  // Reactive state
  const threads = useAuiState((s) => s.threads.threadIds);

  // Events
  useAuiEvent("thread.initialize", () => {
    console.log("New thread created");
  });

  return <div>{threads.length} threads</div>;
}
```

## Item Access Patterns

```tsx
const api = useAui();
const threads = api.threads();

// By ID
const item1 = threads.item({ id: "thread-123" });

// By index (regular threads)
const item2 = threads.item({ index: 0 });

// By index (archived)
const item3 = threads.item({ index: 0, archived: true });

// Current thread
const mainItem = threads.item("main");
```

## Batch Operations

```tsx
async function archiveThreadsByTitlePrefix(prefix: string) {
  const api = useAui();
  const { threadIds } = api.threads().getState();

  for (const threadId of threadIds) {
    const item = api.threads().item({ id: threadId });
    const state = item.getState();
    const title = (state.title || "").toLowerCase();

    if (title.startsWith(prefix.toLowerCase())) {
      await item.archive();
    }
  }
}
```

## Thread Data

Access thread metadata:

```tsx
const item = api.threads().item({ id: threadId });
const state = item.getState();

// {
//   id: "thread-123",
//   remoteId: "remote-123",
//   externalId: "ext-123",
//   title: "Chat about React",
//   status: "regular",
// }
```

## Thread Initialization

When using cloud persistence, threads are lazily initialized:

```tsx
const item = api.threads().item({ id: localThreadId });

// Initialize creates remote mapping
const { remoteId, externalId } = await item.initialize();

// Now thread is persisted to cloud
```

## Error Handling

```tsx
async function safeDelete(threadId: string) {
  const api = useAui();
  const item = api.threads().item({ id: threadId });

  try {
    await item.delete();
  } catch (error) {
    if (error.message.includes("not found")) {
      // Thread already deleted
      return;
    }
    throw error;
  }
}
```

## Sorting and Filtering

Thread list can be sorted by title or by ID for custom ordering:

```tsx
function SortedThreadList({ sortBy }: { sortBy: "title" | "id" }) {
  const { threads } = useAuiState((s) => ({ threads: s.threads.threadIds }));
  const api = useAui();

  const sorted = [...threads].sort((a, b) => {
    const itemA = api.threads().item({ id: a }).getState();
    const itemB = api.threads().item({ id: b }).getState();

    if (sortBy === "title") {
      return (itemA.title || "").localeCompare(itemB.title || "");
    }
    return b.localeCompare(a);
  });

  return (
    <div>
      {sorted.map((id) => (
        <ThreadListItem key={id} id={id} />
      ))}
    </div>
  );
}
```

## Keyboard Navigation

```tsx
function KeyboardNav() {
  const { threads, mainThreadId } = useAuiState((s) => ({
    threads: s.threads.threadIds,
    mainThreadId: s.threads.mainThreadId,
  }));
  const api = useAui();

  const currentIndex = threads.indexOf(mainThreadId);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" && currentIndex > 0) {
      api.threads().switchToThread(threads[currentIndex - 1]);
    }
    if (e.key === "ArrowDown" && currentIndex < threads.length - 1) {
      api.threads().switchToThread(threads[currentIndex + 1]);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, threads]);

  return null;
}
```
