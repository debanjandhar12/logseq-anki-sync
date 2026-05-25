import {
    AuiIf,
    ThreadListItemMorePrimitive,
    ThreadListItemPrimitive,
    ThreadListPrimitive
} from "@assistant-ui/react";
import type {FC} from "react";
import {ThreadListItemMore, ThreadListSkeleton} from "src/shadcn/assistant-ui/thread-list";

interface ThreadListProps {
    onThreadSelected?: () => void;
}

/**
 * Changes:
 * (a) Added onThreadSelected callback by decomposing ThreadListItem
 */
export const ThreadList: FC<ThreadListProps> = ({onThreadSelected}) => {
    return (
        <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col gap-1 p-2">
            <AuiIf condition={(s) => s.threads.isLoading}>
                <ThreadListSkeleton />
            </AuiIf>
            <AuiIf condition={(s) => !s.threads.isLoading}>
                <ThreadListPrimitive.Items>
                    {() => <ThreadListItem onThreadSelected={onThreadSelected} />}
                </ThreadListPrimitive.Items>
            </AuiIf>
        </ThreadListPrimitive.Root>
    );
};

/**
 * Changes:
 * (a) Added onThreadSelected callback by decomposing ThreadListItem
 */
const ThreadListItem: FC<ThreadListProps> = ({onThreadSelected}) => {
    return (
        <ThreadListItemPrimitive.Root className="aui-thread-list-item group flex h-9 items-center gap-2 rounded-lg transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none data-active:bg-muted">
            <ThreadListItemPrimitive.Trigger
                className="aui-thread-list-item-trigger flex h-full min-w-0 flex-1 items-center px-3 text-start text-sm"
                onClick={onThreadSelected}>
                <span className="aui-thread-list-item-title min-w-0 flex-1 truncate">
                    <ThreadListItemPrimitive.Title fallback="New Chat" />
                </span>
            </ThreadListItemPrimitive.Trigger>
            <ThreadListItemMore />
        </ThreadListItemPrimitive.Root>
    );
};