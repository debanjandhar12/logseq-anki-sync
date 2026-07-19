import {
    ThreadListItemMorePrimitive,
    ThreadListPrimitive,
    type ThreadMessage,
    useAuiState
} from "@assistant-ui/react";
import {getThreadMessageTokenUsage} from "@assistant-ui/react-ai-sdk";
import {DevToolsPanel} from "@assistant-ui/react-devtools";
import {ArrowLeftIcon, HistoryIcon, MoreHorizontalIcon, PlusIcon, XIcon} from "lucide-react";
import {type FC, useContext, useState} from "react";
import {ContextDisplay} from "../../shadcn/assistant-ui/context-display";
import {TooltipIconButton} from "../../shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "../../shadcn/radix-ui/button";
import {TooltipProvider} from "../../shadcn/radix-ui/tooltip";
import {ChatUIContext} from "../context/ChatUIContext";
import {PendingLogseqChangesDisplay} from "./PendingLogseqChangesDisplay";

const DEFAULT_MODEL_CONTEXT_WINDOW = 128_000;

interface ThreadTopToolBarProps {
    isHistoryVisible: boolean;
    onBackToThread: () => void;
    onShowHistory: () => void;
}

export const ThreadTopToolBar: FC<ThreadTopToolBarProps> = ({
    isHistoryVisible,
    onBackToThread,
    onShowHistory
}) => {
    const {onClose} = useContext(ChatUIContext);
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
    const latestMessageWithUsage = useAuiState((s) =>
        findLatestMessageWithUsage(s.thread.messages)
    );
    const contextUsage = getThreadMessageTokenUsage(latestMessageWithUsage);

    const handleOpenDevTools = () => {
        setIsDevToolsOpen(true);
    };

    const handleExportAsPage = () => {
        logseq.UI.showMsg("not implemented");
    };

    return (
        <div className="flex h-10 shrink-0 items-center justify-end border-b bg-background px-3">
            <div className="flex items-center gap-1">
                <PendingLogseqChangesDisplay side="bottom" />
                {contextUsage && (
                    <TooltipProvider delayDuration={0}>
                        <ContextDisplay.Ring
                            modelContextWindow={DEFAULT_MODEL_CONTEXT_WINDOW}
                            usage={contextUsage}
                            side="bottom"
                            className="size-6 [&_circle:first-child]:stroke-muted-foreground/10"
                        />
                    </TooltipProvider>
                )}
                <ThreadTopToolBarMore
                    onOpenDevTools={handleOpenDevTools}
                    onExportAsPage={handleExportAsPage}
                />
                {isHistoryVisible ? (
                    <TooltipIconButton tooltip="Back to thread" onClick={onBackToThread}>
                        <ArrowLeftIcon className="size-5" />
                    </TooltipIconButton>
                ) : (
                    <TooltipIconButton tooltip="Thread history" onClick={onShowHistory}>
                        <HistoryIcon className="size-5" />
                    </TooltipIconButton>
                )}
                <ThreadListPrimitive.New asChild>
                    <TooltipIconButton tooltip="New thread" onClick={onBackToThread}>
                        <PlusIcon className="size-5" />
                    </TooltipIconButton>
                </ThreadListPrimitive.New>
                {onClose && (
                    <TooltipIconButton
                        tooltip="Close chat"
                        onClick={onClose}
                        className="hover:text-destructive">
                        <XIcon className="size-5" />
                    </TooltipIconButton>
                )}
            </div>
            {isDevToolsOpen && import.meta.env.DEV && (
                <div className="fixed inset-0 z-[10000] bg-background/80 p-6">
                    <div className="relative h-full overflow-hidden rounded-xl border bg-background shadow-xl">
                        <DevToolsPanel onClose={() => setIsDevToolsOpen(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

interface ThreadTopToolBarMoreProps {
    onOpenDevTools: () => void;
    onExportAsPage: () => void;
}

/**
 * Changes:
 * (a) Changed the more menu button's hover background to bg-background for better visibility over bg-muted rows
 */
const ThreadTopToolBarMore: FC<ThreadTopToolBarMoreProps> = ({onOpenDevTools, onExportAsPage}) => {
    return (
        <ThreadListItemMorePrimitive.Root>
            <ThreadListItemMorePrimitive.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 p-1 data-[state=open]:bg-accent">
                    <MoreHorizontalIcon className="size-4" />
                    <span className="sr-only">More options</span>
                </Button>
            </ThreadListItemMorePrimitive.Trigger>
            <ThreadListItemMorePrimitive.Content
                side="bottom"
                align="end"
                className="aui-thread-list-item-more-content z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {import.meta.env.DEV && (
                    <ThreadListItemMorePrimitive.Item
                        className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-background hover:text-accent-foreground focus:bg-background focus:text-accent-foreground"
                        onClick={onOpenDevTools}>
                        Devtools
                    </ThreadListItemMorePrimitive.Item>
                )}
                <ThreadListItemMorePrimitive.Item
                    className="aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-background hover:text-accent-foreground focus:bg-background focus:text-accent-foreground"
                    onClick={onExportAsPage}>
                    Export as Page
                </ThreadListItemMorePrimitive.Item>
            </ThreadListItemMorePrimitive.Content>
        </ThreadListItemMorePrimitive.Root>
    );
};

function findLatestMessageWithUsage(messages: readonly ThreadMessage[]): ThreadMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (getThreadMessageTokenUsage(message)) {
            return message;
        }
    }
    return undefined;
}
