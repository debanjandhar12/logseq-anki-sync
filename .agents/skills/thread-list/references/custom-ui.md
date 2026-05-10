# Custom Thread List UI

Build custom thread list interfaces.

## Using Primitives

```tsx
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";

function CustomThreadList() {
  return (
    <ThreadListPrimitive.Root className="flex flex-col h-full">
      {/* New thread button */}
      <ThreadListPrimitive.New className="m-2 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
        + New Conversation
      </ThreadListPrimitive.New>

      {/* Thread items */}
      <div className="flex-1 overflow-y-auto">
        <ThreadListPrimitive.Items>
          <CustomThreadItem />
        </ThreadListPrimitive.Items>
      </div>

      {/* Archived section */}
      <div className="border-t p-2">
        <h3 className="text-sm text-gray-500 mb-2">Archived</h3>
        <ThreadListPrimitive.Items archived>
          <CustomThreadItem archived />
        </ThreadListPrimitive.Items>
      </div>
    </ThreadListPrimitive.Root>
  );
}

function CustomThreadItem({ archived = false }) {
  return (
    <ThreadListItemPrimitive.Root className="group flex items-center p-2 rounded hover:bg-gray-100">
      <ThreadListItemPrimitive.Trigger className="flex-1 text-left truncate">
        <ThreadListItemPrimitive.Title />
      </ThreadListItemPrimitive.Trigger>

      <div className="hidden group-hover:flex gap-1">
        {archived ? (
          <ThreadListItemPrimitive.Unarchive className="p-1 text-gray-500 hover:text-green-600">
            ↩️
          </ThreadListItemPrimitive.Unarchive>
        ) : (
          <ThreadListItemPrimitive.Archive className="p-1 text-gray-500 hover:text-yellow-600">
            📁
          </ThreadListItemPrimitive.Archive>
        )}
        <ThreadListItemPrimitive.Delete className="p-1 text-gray-500 hover:text-red-600">
          🗑️
        </ThreadListItemPrimitive.Delete>
      </div>
    </ThreadListItemPrimitive.Root>
  );
}
```

## Fully Custom with Hooks

```tsx
import { useAui, useAuiState } from "@assistant-ui/react";

function FullyCustomThreadList() {
  const api = useAui();
  const { threads, archivedThreads, mainThreadId, isLoading } = useAuiState((s) => ({
    threads: s.threads.threadIds,
    archivedThreads: s.threads.archivedThreadIds,
    mainThreadId: s.threads.mainThreadId,
    isLoading: s.threads.isLoading,
  }));

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="w-64 h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b">
        <button
          onClick={() => api.threads().switchToNewThread()}
          className="w-full py-2 bg-blue-500 text-white rounded-lg"
        >
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <nav className="p-2 space-y-1">
        {threads.map((threadId) => (
          <ThreadItem
            key={threadId}
            id={threadId}
            isActive={threadId === mainThreadId}
          />
        ))}
      </nav>

      {/* Archived */}
      {archivedThreads.length > 0 && (
        <div className="border-t mt-4 pt-4 px-2">
          <h3 className="text-xs text-gray-500 uppercase mb-2">Archived</h3>
          {archivedThreads.map((threadId) => (
            <ThreadItem key={threadId} id={threadId} archived />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadItem({
  id,
  isActive = false,
  archived = false,
}: {
  id: string;
  isActive?: boolean;
  archived?: boolean;
}) {
  const api = useAui();
  const item = api.threads().item({ id });
  const state = item.getState();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(state.title || "");

  const handleRename = async () => {
    await item.rename(title);
    setIsEditing(false);
  };

  return (
    <div
      className={`group flex items-center p-2 rounded cursor-pointer ${
        isActive ? "bg-blue-100" : "hover:bg-gray-100"
      }`}
      onClick={() => item.switchTo()}
    >
      {isEditing ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          className="flex-1 px-2 py-1 text-sm border rounded"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="flex-1 truncate text-sm">
            {state.title || "Untitled"}
          </span>
          <div className="hidden group-hover:flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              ✏️
            </button>
            {archived ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  item.unarchive();
                }}
                className="p-1 text-gray-400 hover:text-green-600"
              >
                ↩️
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  item.archive();
                }}
                className="p-1 text-gray-400 hover:text-yellow-600"
              >
                📁
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this conversation?")) {
                  item.delete();
                }
              }}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

## With Search

```tsx
function SearchableThreadList() {
  const [search, setSearch] = useState("");
  const api = useAui();
  const { threads, mainThreadId } = useAuiState((s) => ({
    threads: s.threads.threadIds,
    mainThreadId: s.threads.mainThreadId,
  }));

  const filteredThreads = threads.filter((id) => {
    if (!search) return true;
    const item = api.threads().item({ id }).getState();
    return item.title?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* New button */}
      <button
        onClick={() => api.threads().switchToNewThread()}
        className="mx-2 py-2 bg-blue-500 text-white rounded-lg"
      >
        + New Chat
      </button>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredThreads.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No results</p>
        ) : (
          filteredThreads.map((id) => (
            <ThreadItem
              key={id}
              id={id}
              isActive={id === mainThreadId}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

## With Drag and Drop

```tsx
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function DraggableThreadList() {
  const api = useAui();
  const { threads } = useAuiState((s) => ({ threads: s.threads.threadIds }));
  const [orderedThreads, setOrderedThreads] = useState(threads);

  useEffect(() => {
    setOrderedThreads(threads);
  }, [threads]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(orderedThreads);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    setOrderedThreads(items);
    // Optionally persist order to backend
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="threads">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {orderedThreads.map((id, index) => (
              <Draggable key={id} draggableId={id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <ThreadItem id={id} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

## Modal/Dropdown Style

```tsx
function ThreadDropdown() {
  const [open, setOpen] = useState(false);
  const api = useAui();
  const { threads, mainThreadId } = useAuiState((s) => ({
    threads: s.threads.threadIds,
    mainThreadId: s.threads.mainThreadId,
  }));
  const currentItem = api.threads().item("main").getState();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 border rounded-lg flex items-center gap-2"
      >
        <span>{currentItem.title || "Select Thread"}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
          <button
            onClick={() => {
              api.threads().switchToNewThread();
              setOpen(false);
            }}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b"
          >
            + New Chat
          </button>
          <div className="max-h-64 overflow-y-auto">
            {threads.map((id) => {
              const item = api.threads().item({ id }).getState();
              return (
                <button
                  key={id}
                  onClick={() => {
                    api.threads().switchToThread(id);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 ${
                    id === mainThreadId ? "bg-blue-50" : ""
                  }`}
                >
                  {item.title || "Untitled"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

## With Categories/Folders

```tsx
function CategorizedThreadList() {
  const api = useAui();
  const { threads } = useAuiState((s) => ({ threads: s.threads.threadIds }));

  // Group by title first letter
  const grouped = threads.reduce((acc, id) => {
    const item = api.threads().item({ id }).getState();
    const category = (item.title || "Untitled").charAt(0).toUpperCase();
    if (!acc[category]) acc[category] = [];
    acc[category].push(id);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div>
      {Object.entries(grouped).map(([category, ids]) => (
        <div key={category} className="mb-4">
          <h3 className="text-sm font-medium text-gray-500 px-2 mb-1">
            {category}
          </h3>
          {ids.map((id) => (
            <ThreadItem key={id} id={id} />
          ))}
        </div>
      ))}
    </div>
  );
}
```
