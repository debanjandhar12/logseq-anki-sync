import {useAssistantRuntime, useAuiState} from "@assistant-ui/react";
import {GitCommitIcon, Trash2Icon, Undo2Icon} from "lucide-react";
import {type FC, useMemo, useState} from "react";
import {createLogger, LoggerCategory} from "src/logger";
import {cn} from "src/shadcn/lib/utils";
import {Button} from "src/shadcn/radix-ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "src/shadcn/radix-ui/popover";
import {revertAndDiscardReviewChanges, revertAndKeepReviewChanges} from "./reviewChangesActions";
import {getReviewChangesLifecycleLabel, getReviewChangesSummary} from "./reviewChangesSelectors";

const logger = createLogger(LoggerCategory.CHAT_UI);

export interface ReviewChangesDisplayProps {
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

export const ReviewChangesDisplay: FC<ReviewChangesDisplayProps> = ({
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
    const summary = useMemo(() => getReviewChangesSummary(messages), [messages]);
    const lifecycleLabel = useMemo(() => getReviewChangesLifecycleLabel(messages), [messages]);

    if (summary.commandCount === 0 || !lifecycleLabel) return null;

    const runAction = async (action: "keep" | "discard") => {
        if (isClearing) return;
        setIsClearing(true);
        try {
            const runtime = assistantRuntime.threads.getById(threadId);
            let shouldClose = true;
            if (action === "keep") {
                await revertAndKeepReviewChanges(threadId, runtime);
            } else {
                shouldClose = await revertAndDiscardReviewChanges(threadId, runtime);
            }
            if (shouldClose) setIsOpen(false);
        } catch (error) {
            await showOperationError(
                action === "keep"
                    ? "Failed to revert applied uncommitted changes"
                    : "Failed to revert and discard uncommitted changes",
                error
            );
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
                    aria-label="Uncommitted changes">
                    <GitCommitIcon className="size-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={side}
                align="end"
                sideOffset={8}
                className="w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
                <div className="grid gap-2 text-xs">
                    <div className="font-medium">{lifecycleLabel}</div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Uncommitted commands</span>
                        <span className="font-mono tabular-nums">{summary.commandCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Changed pages</span>
                        <span className="font-mono tabular-nums">{summary.changedPageCount}</span>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full gap-2"
                        disabled={isClearing || lifecycleLabel !== "Applied uncommitted changes"}
                        onClick={() => void runAction("keep")}>
                        <Undo2Icon className="size-3.5" />
                        Revert
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        disabled={isClearing}
                        onClick={() => void runAction("discard")}>
                        <Trash2Icon className="size-3.5" />
                        Revert and discard
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

async function showOperationError(operation: string, error: unknown): Promise<void> {
    logger.error(operation, error);
    try {
        await logseq.UI.showMsg(operation, "error");
    } catch (notificationError) {
        logger.error(
            `Failed to show uncommitted-change operation error: ${operation}`,
            notificationError
        );
    }
}
