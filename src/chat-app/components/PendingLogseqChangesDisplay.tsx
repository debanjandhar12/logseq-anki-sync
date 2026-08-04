import {
    generateId,
    type ThreadMessage,
    useAssistantRuntime,
    useAuiState
} from "@assistant-ui/react";
import {ToolResponse} from "assistant-stream";
import {GitCommitIcon, Undo2Icon} from "lucide-react";
import {type FC, useMemo, useState} from "react";
import {cancelPendingToolCallsInThread} from "src/chat-app/runtime/cancelPendingToolCallsInThread";
import {LogseqClearChangesTool} from "src/chat-app/tools/impl/LogseqClearChangesTool";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {createLogger, LoggerCategory} from "src/logger";
import {cn} from "src/shadcn/lib/utils";
import {Button} from "src/shadcn/radix-ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "src/shadcn/radix-ui/popover";

const logger = createLogger(LoggerCategory.CHAT_UI);

interface PendingLogseqChangesDisplayProps {
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

interface PendingLogseqChangesSummary {
    commandCount: number;
    changedPageCount: number;
}

const EMPTY_PENDING_LOGSEQ_CHANGES_SUMMARY: PendingLogseqChangesSummary = {
    commandCount: 0,
    changedPageCount: 0
};

export const getPendingLogseqChangesSummary = (
    messages: readonly ThreadMessage[]
): PendingLogseqChangesSummary => {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker) return EMPTY_PENDING_LOGSEQ_CHANGES_SUMMARY;

    const commandCount = locatedTracker.tracker.getGraphMutationCommandCount();
    if (commandCount === 0) return EMPTY_PENDING_LOGSEQ_CHANGES_SUMMARY;

    return {
        commandCount,
        changedPageCount: locatedTracker.tracker.getChangedPages().length
    };
};

export const getPendingLogseqChangesCommandCount = (messages: readonly ThreadMessage[]): number =>
    getPendingLogseqChangesSummary(messages).commandCount;

export const PendingLogseqChangesDisplay: FC<PendingLogseqChangesDisplayProps> = ({
    className,
    side = "bottom"
}) => {
    const assistantRuntime = useAssistantRuntime();
    const messages = useAuiState((state) => state.thread.messages);
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const [isClearing, setIsClearing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const pendingChangesSummary = useMemo(
        () => getPendingLogseqChangesSummary(messages),
        [messages]
    );

    if (pendingChangesSummary.commandCount === 0) return null;

    const clearUncommittedChanges = async () => {
        if (isClearing) return;
        setIsClearing(true);
        try {
            const runtime = assistantRuntime.threads.getById(threadId);
            if (runtime.getState().isRunning) {
                runtime.cancelRun();
                await waitForThreadRunToStop(runtime);
            }
            await cancelPendingToolCallsInThread({threadId, runtime});

            const currentMessages = runtime.getState().messages;
            const output = await new LogseqClearChangesTool().execute(
                {},
                {messages: currentMessages}
            );
            const response = ToolResponse.toResponse(output);
            runtime.append({
                role: "assistant",
                startRun: false,
                content: [
                    {
                        type: "tool-call",
                        toolCallId: generateId(),
                        toolName: LogseqClearChangesTool.NAME,
                        args: {},
                        argsText: "{}",
                        result: response.result,
                        isError: response.isError,
                        artifact: response.artifact
                    }
                ]
            });
            setIsOpen(false);
        } catch (error) {
            logger.error("Failed to clear pending Logseq changes", error);
            await logseq.UI.showMsg("Failed to clear pending Logseq changes", "error");
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex size-6 items-center justify-center rounded-md p-1 text-amber-500 transition-colors hover:bg-accent hover:text-amber-500",
                        className
                    )}
                    aria-label="Pending Logseq changes">
                    <GitCommitIcon className="size-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={side}
                align="end"
                sideOffset={8}
                className="w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
                <div className="grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Pending commands</span>
                        <span className="font-mono tabular-nums">
                            {pendingChangesSummary.commandCount}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Changed pages</span>
                        <span className="font-mono tabular-nums">
                            {pendingChangesSummary.changedPageCount}
                        </span>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="mt-1 w-full gap-2"
                        disabled={isClearing}
                        onClick={() => void clearUncommittedChanges()}>
                        <Undo2Icon className="size-3.5" />
                        Clear Uncommited changes
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

async function waitForThreadRunToStop(runtime: {
    getState: () => {isRunning: boolean};
}): Promise<void> {
    const deadline = Date.now() + 3_000;
    while (runtime.getState().isRunning && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (runtime.getState().isRunning) {
        throw new Error("Timed out while stopping the current chat run");
    }
}
