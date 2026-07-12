import {
    AuiIf,
    ThreadListItemMorePrimitive,
    ThreadListItemPrimitive,
    ThreadListPrimitive,
    useAui,
    useAuiState
} from "@assistant-ui/react";
import {EditIcon, MoreHorizontalIcon, TrashIcon} from "lucide-react";
import type {FC} from "react";
import {ThreadListSkeleton} from "src/shadcn/assistant-ui/thread-list";
import {Button} from "src/shadcn/radix-ui/button";
import {showInputModal} from "src/ui/launchers/showInputModal";

interface ThreadListProps {
    onThreadSelected?: () => void;
}

/**
 * Changes:
 * (a) Added onThreadSelected callback by decomposing ThreadListItem
 * (b) Added h-full overflow-y-auto css.
 * (c) Keeps project rename/delete behavior while adopting current focus and active-state styling.
 */
export const ThreadList: FC<ThreadListProps> = ({onThreadSelected}) => {
    return (
        <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex h-full flex-col gap-0.5 overflow-y-auto p-2">
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
 * (b) Added h-9 and shrink-0 to prevent resize from flex container.
 */
const ThreadListItem: FC<ThreadListProps> = ({onThreadSelected}) => {
    return (
        <ThreadListItemPrimitive.Root
            data-slot="aui_thread-list-item"
            className="group hover:bg-muted focus-visible:bg-muted data-active:bg-muted has-focus-visible:bg-muted has-data-[state=open]:bg-muted relative flex h-9 items-center gap-2 rounded-lg transition-colors focus-visible:outline-none">
            <ThreadListItemPrimitive.Trigger
                data-slot="aui_thread-list-item-trigger"
                className="focus-visible:ring-ring/50 flex h-9 shrink-0 min-w-0 flex-1 items-center rounded-md px-3 text-start text-sm outline-none group-hover:pe-10 group-has-focus-visible:pe-10 group-has-data-[state=open]:pe-10 group-data-active:pe-10 focus-visible:ring-[3px]"
                onClick={onThreadSelected}>
                <span data-slot="aui_thread-list-item-title" className="min-w-0 flex-1 truncate">
                    <ThreadListItemPrimitive.Title fallback="New Chat" />
                </span>
            </ThreadListItemPrimitive.Trigger>
            <ThreadListItemMore />
        </ThreadListItemPrimitive.Root>
    );
};

/**
 * Changes:
 * (a) Remove ThreadListItemPrimitive.Archive
 * (b) Added Rename item with showInputModal and useAui/useAuiState hooks
 */
const ThreadListItemMore: FC = () => {
    const threadId = useAuiState((s) => s.threadListItem.id);
    const currentTitle = useAuiState((s) => s.threadListItem.title);
    const api = useAui();

    const handleRename = async () => {
        const newName = await showInputModal({
            title: "Rename Thread",
            initialValue: currentTitle,
            placeholder: "Enter new thread name"
        });
        if (newName) {
            api.threads().item({id: threadId}).rename(newName);
        }
    };

    return (
        <ThreadListItemMorePrimitive.Root sharedFocusGroup>
            <ThreadListItemMorePrimitive.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    data-slot="aui_thread-list-item-more"
                    className="data-[state=open]:bg-accent absolute end-2 top-1/2 size-7 -translate-y-1/2 p-0 opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-data-active:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontalIcon className="size-4" />
                    <span className="sr-only">More options</span>
                </Button>
            </ThreadListItemMorePrimitive.Trigger>
            <ThreadListItemMorePrimitive.Content
                side="bottom"
                align="start"
                className="aui-thread-list-item-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {/*<ThreadListItemPrimitive.Archive asChild>*/}
                {/*    <ThreadListItemMorePrimitive.Item className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">*/}
                {/*        <ArchiveIcon className="size-4" />*/}
                {/*        Archive*/}
                {/*    </ThreadListItemMorePrimitive.Item>*/}
                {/*</ThreadListItemPrimitive.Archive>*/}
                <ThreadListItemMorePrimitive.Item
                    className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onClick={handleRename}>
                    <EditIcon className="size-4" />
                    Rename
                </ThreadListItemMorePrimitive.Item>
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
