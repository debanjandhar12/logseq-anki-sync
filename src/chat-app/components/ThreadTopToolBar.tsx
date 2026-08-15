import {
    ThreadListItemMorePrimitive,
    ThreadListPrimitive,
    type ThreadMessage,
    useAuiState
} from "@assistant-ui/react";
import {getThreadMessageTokenUsage} from "@assistant-ui/react-ai-sdk";
import {DevToolsPanel} from "@assistant-ui/react-devtools";
import {ArrowLeftIcon, HistoryIcon, MoreHorizontalIcon, PlusIcon, XIcon} from "lucide-react";
import {type FC, useContext, useRef, useState} from "react";
import {createLogger, LoggerCategory} from "../../logger";
import {ContextDisplay} from "../../shadcn/assistant-ui/context-display";
import {TooltipIconButton} from "../../shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "../../shadcn/radix-ui/button";
import {TooltipProvider} from "../../shadcn/radix-ui/tooltip";
import {ChatUIContext} from "../context/ChatUIContext";
import {ChatPageExporter} from "../export/ChatPageExporter";
import {ReviewChangesDisplay} from "./ReviewChangesDisplay";

const DEFAULT_MODEL_CONTEXT_WINDOW = 128_000;
const logger = createLogger(LoggerCategory.CHAT_UI);

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
    const [isExportInProgress, setIsExportInProgress] = useState(false);
    const isExportInProgressRef = useRef(false);
    const messages = useAuiState((state) => state.thread.messages);
    const threadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadTitle = useAuiState((state) => state.threadListItem.title);
    const threadStatus = useAuiState((state) => state.threadListItem.status);
    const latestMessageWithUsage = findLatestMessageWithUsage(messages);
    const contextUsage = getThreadMessageTokenUsage(latestMessageWithUsage);
    const isPageExportDisabled = !isThreadPageExportEnabled(
        threadStatus,
        threadId,
        messages.length,
        isExportInProgress
    );

    const handleOpenDevTools = () => {
        setIsDevToolsOpen(true);
    };

    const handleExportAsPage = async () => {
        if (isPageExportDisabled || !threadId || isExportInProgressRef.current) return;

        const capturedThreadId = threadId;
        const capturedThreadTitle = threadTitle;
        const capturedMessages = [...messages];
        isExportInProgressRef.current = true;
        setIsExportInProgress(true);
        try {
            const {pageName} = await ChatPageExporter.exportThread({
                threadId: capturedThreadId,
                threadTitle: capturedThreadTitle,
                messages: capturedMessages
            });
            await notify(`Chat exported to page: ${pageName}`, "success");
        } catch {
            await notify("Failed to export chat as page", "error");
        } finally {
            isExportInProgressRef.current = false;
            setIsExportInProgress(false);
        }
    };

    return (
        <div className="flex h-10 shrink-0 items-center justify-end border-b bg-background px-3">
            <div className="flex items-center gap-1">
                <ReviewChangesDisplay side="bottom" />
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
                    onExportAsPage={() => void handleExportAsPage()}
                    isPageExportDisabled={isPageExportDisabled}
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
    isPageExportDisabled: boolean;
}

/**
 * Changes:
 * (a) Changed the more menu button's hover background to bg-background for better visibility over bg-muted rows
 * (b) Added page export with an active-thread disabled state; the exporter owns export and navigation while this toolbar owns busy state and notifications
 * (c) Made the menu controlled and non-modal so outside interactions close it through the Shadow DOM portal bridge
 */
export const ThreadTopToolBarMore: FC<ThreadTopToolBarMoreProps> = ({
    onOpenDevTools,
    onExportAsPage,
    isPageExportDisabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const exportActionClassName =
        "aui-thread-list-item-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-background hover:text-accent-foreground focus:bg-background focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";
    const selectAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <ThreadListItemMorePrimitive.Root modal={false} open={isOpen} onOpenChange={setIsOpen}>
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
                        onSelect={() => selectAction(onOpenDevTools)}>
                        Devtools
                    </ThreadListItemMorePrimitive.Item>
                )}
                <ThreadListItemMorePrimitive.Item
                    className={exportActionClassName}
                    disabled={isPageExportDisabled}
                    onSelect={() => selectAction(onExportAsPage)}>
                    Export as Page
                </ThreadListItemMorePrimitive.Item>
            </ThreadListItemMorePrimitive.Content>
        </ThreadListItemMorePrimitive.Root>
    );
};

export function isThreadPageExportEnabled(
    status: string | undefined,
    threadId: string | undefined,
    messageCount: number,
    isBusy: boolean
): boolean {
    return status === "regular" && Boolean(threadId) && messageCount > 0 && !isBusy;
}

async function notify(message: string, type: "success" | "error"): Promise<void> {
    try {
        await logseq.UI.showMsg(message, type);
    } catch (error) {
        logger.error("Failed to show chat toolbar notification", {message, type, error});
    }
}

function findLatestMessageWithUsage(messages: readonly ThreadMessage[]): ThreadMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (getThreadMessageTokenUsage(message)) {
            return message;
        }
    }
    return undefined;
}
