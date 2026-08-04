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
import {LogseqClearTemporaryChangesTool} from "src/chat-app/tools/impl/LogseqClearTemporaryChangesTool";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {createLogger, LoggerCategory} from "src/logger";
import {cn} from "src/shadcn/lib/utils";
import {Button} from "src/shadcn/radix-ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "src/shadcn/radix-ui/popover";

const logger = createLogger(LoggerCategory.CHAT_UI);

interface TemporaryLogseqChangesDisplayProps {
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

interface TemporaryLogseqChangesSummary {
    commandCount: number;
    changedPageCount: number;
}

const EMPTY_TEMPORARY_LOGSEQ_CHANGES_SUMMARY: TemporaryLogseqChangesSummary = {
    commandCount: 0,
    changedPageCount: 0
};

export const getTemporaryLogseqChangesSummary = (
    messages: readonly ThreadMessage[]
): TemporaryLogseqChangesSummary => {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker) return EMPTY_TEMPORARY_LOGSEQ_CHANGES_SUMMARY;

    const commandCount = locatedTracker.tracker.getGraphMutationCommandCount();
    if (commandCount === 0) return EMPTY_TEMPORARY_LOGSEQ_CHANGES_SUMMARY;

    return {
        commandCount,
        changedPageCount: locatedTracker.tracker.getChangedPages().length
    };
};

export const getTemporaryLogseqChangesCommandCount = (messages: readonly ThreadMessage[]): number =>
    getTemporaryLogseqChangesSummary(messages).commandCount;

export const TemporaryLogseqChangesDisplay: FC<TemporaryLogseqChangesDisplayProps> = ({
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
    const temporaryChangesSummary = useMemo(
        () => getTemporaryLogseqChangesSummary(messages),
        [messages]
    );

    if (temporaryChangesSummary.commandCount === 0) return null;

    const discardTemporaryChanges = async () => {
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
            const output = await new LogseqClearTemporaryChangesTool().execute(
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
                        toolName: LogseqClearTemporaryChangesTool.NAME,
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
            logger.error("Failed to discard temporary Logseq changes", error);
            await logseq.UI.showMsg("Failed to discard temporary Logseq changes", "error");
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
                    aria-label="Temporary Logseq changes">
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
                        <span className="text-muted-foreground">Temporary commands</span>
                        <span className="font-mono tabular-nums">
                            {temporaryChangesSummary.commandCount}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Changed pages</span>
                        <span className="font-mono tabular-nums">
                            {temporaryChangesSummary.changedPageCount}
                        </span>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="mt-1 w-full gap-2"
                        disabled={isClearing}
                        onClick={() => void discardTemporaryChanges()}>
                        <Undo2Icon className="size-3.5" />
                        Discard temporary changes
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
