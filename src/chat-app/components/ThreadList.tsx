import {
    AuiIf,
    ThreadListItemMorePrimitive,
    ThreadListItemPrimitive,
    ThreadListPrimitive
} from "@assistant-ui/react";
import {ArchiveIcon, MoreHorizontalIcon, TrashIcon} from "lucide-react";
import type {FC} from "react";
import {ThreadListSkeleton} from "src/shadcn/assistant-ui/thread-list";
import {Button} from "src/shadcn/radix-ui/button";

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

/**
 * Changes:
 * (a) Relies on the app-level Shadow DOM compatibility boundary for portal and positioning.
 */
const ThreadListItemMore: FC = () => {
    return (
        <ThreadListItemMorePrimitive.Root>
            <ThreadListItemMorePrimitive.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="aui-thread-list-item-more me-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:bg-accent data-[state=open]:opacity-100 group-data-active:opacity-100">
                    <MoreHorizontalIcon className="size-4" />
                    <span className="sr-only">More options</span>
                </Button>
            </ThreadListItemMorePrimitive.Trigger>
            <ThreadListItemMorePrimitive.Content
                side="bottom"
                align="start"
                className="aui-thread-list-item-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <ThreadListItemPrimitive.Archive asChild>
                    <ThreadListItemMorePrimitive.Item className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <ArchiveIcon className="size-4" />
                        Archive
                    </ThreadListItemMorePrimitive.Item>
                </ThreadListItemPrimitive.Archive>
                <ThreadListItemPrimitive.Delete asChild>
                    <ThreadListItemMorePrimitive.Item className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-destructive text-sm outline-none hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <TrashIcon className="size-4" />
                        Delete
                    </ThreadListItemMorePrimitive.Item>
                </ThreadListItemPrimitive.Delete>
            </ThreadListItemMorePrimitive.Content>
        </ThreadListItemMorePrimitive.Root>
    );
};
