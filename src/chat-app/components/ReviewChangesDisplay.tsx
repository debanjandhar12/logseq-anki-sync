import {
    generateId,
    type ThreadMessage,
    type ThreadRuntime,
    useAssistantRuntime,
    useAuiState
} from "@assistant-ui/react";
import {ToolResponse} from "assistant-stream";
import type {ReadonlyJSONObject} from "assistant-stream/utils";
import {GitCommitIcon, Trash2Icon, Undo2Icon} from "lucide-react";
import {type FC, useMemo, useState} from "react";
import {persistLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {stopThread} from "src/chat-app/runtime/stopThread";
import {LogseqClearUncommittedChangesTool} from "src/chat-app/tools/impl/LogseqClearUncommittedChangesTool";
import {
    findLastLogseqReversibleTransactionTracker,
    type LocatedLogseqReversibleTransactionTracker
} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {createLogger, LoggerCategory} from "src/logger";
import {cn} from "src/shadcn/lib/utils";
import {Button} from "src/shadcn/radix-ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "src/shadcn/radix-ui/popover";
import {showConfirmModal} from "src/ui/launchers/showConfirmModal";

const logger = createLogger(LoggerCategory.CHAT_UI);

export interface ReviewChangesDisplayProps {
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

export interface ReviewChangesSummary {
    commandCount: number;
    changedPageCount: number;
}

export type ReviewChangesLifecycleLabel =
    | "Applied uncommitted changes"
    | "Not applied uncommitted changes";

const EMPTY_REVIEW_CHANGES_SUMMARY: ReviewChangesSummary = {
    commandCount: 0,
    changedPageCount: 0
};

export const getReviewChangesSummary = (
    messages: readonly ThreadMessage[]
): ReviewChangesSummary => {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker) return EMPTY_REVIEW_CHANGES_SUMMARY;

    const commandCount = locatedTracker.tracker.getGraphMutationCommandCount();
    if (commandCount === 0) return EMPTY_REVIEW_CHANGES_SUMMARY;

    return {
        commandCount,
        changedPageCount: locatedTracker.tracker.getChangedPages().length
    };
};

export const getReviewChangesCommandCount = (messages: readonly ThreadMessage[]): number =>
    getReviewChangesSummary(messages).commandCount;

export const getReviewChangesLifecycleLabel = (
    messages: readonly ThreadMessage[]
): ReviewChangesLifecycleLabel | null => {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker || locatedTracker.tracker.getGraphMutationCommandCount() === 0) {
        return null;
    }

    return locatedTracker.tracker.hasAppliedGraphMutations()
        ? "Applied uncommitted changes"
        : "Not applied uncommitted changes";
};

type ReviewChangesNotification = (message: string) => Promise<unknown>;

export interface ReviewChangesActionDependencies {
    createDiscardTool: () => LogseqClearUncommittedChangesTool;
    notify: ReviewChangesNotification;
    persistTrackerArtifact: typeof persistLogseqReversibleTransactionTrackerArtifact;
    showConfirm: typeof showConfirmModal;
    stopThread: typeof stopThread;
}

const defaultReviewChangesActionDependencies: ReviewChangesActionDependencies = {
    createDiscardTool: () => new LogseqClearUncommittedChangesTool(),
    notify: (message) => logseq.UI.showMsg(message, "error"),
    persistTrackerArtifact: persistLogseqReversibleTransactionTrackerArtifact,
    showConfirm: showConfirmModal,
    stopThread
};

export async function revertAndKeepReviewChanges(
    threadId: string,
    runtime: ThreadRuntime,
    dependencies: Pick<
        ReviewChangesActionDependencies,
        "notify" | "persistTrackerArtifact"
    > = defaultReviewChangesActionDependencies
): Promise<"retained" | "discarded"> {
    const currentMessages = runtime.getState().messages;
    const locatedTracker = findLastLogseqReversibleTransactionTracker(currentMessages);
    if (!locatedTracker) return "retained";

    const {tracker} = locatedTracker;

    try {
        if (tracker.hasAppliedGraphMutations()) {
            await tracker.revertAppliedCommands();
        }
    } catch (error) {
        const errorMessage = getErrorMessageFromErrObj(error);
        const warning = `Failed to revert applied uncommitted changes: ${errorMessage}. Uncommitted changes were discarded.`;
        logger.error("Failed to revert applied uncommitted changes while retaining them", error);
        tracker.clear();
        await showReviewChangesRevertFailure(dependencies.notify, warning);
        await persistReviewChangesTrackerArtifact(
            threadId,
            runtime,
            locatedTracker,
            dependencies.persistTrackerArtifact
        );
        return "discarded";
    }

    await persistReviewChangesTrackerArtifact(
        threadId,
        runtime,
        locatedTracker,
        dependencies.persistTrackerArtifact
    );
    return "retained";
}

export async function revertAndDiscardReviewChanges(
    threadId: string,
    runtime: ThreadRuntime,
    dependencies: Partial<ReviewChangesActionDependencies> = {}
): Promise<boolean> {
    const actions = {...defaultReviewChangesActionDependencies, ...dependencies};
    if (runtime.getState().isRunning) {
        await actions.stopThread({threadId, runtime});
    }

    const confirmed = await actions.showConfirm(
        "Revert applied uncommitted changes and discard all uncommitted changes?",
        {
            confirmText: "Revert and discard",
            cancelText: "Keep uncommitted changes"
        }
    );
    if (!confirmed) return false;

    await actions.stopThread({threadId, runtime});
    const currentMessages = runtime.getState().messages;
    const output = await actions.createDiscardTool().execute({}, {messages: currentMessages});
    appendSyntheticToolResponse(runtime, LogseqClearUncommittedChangesTool.NAME, {}, output);
    return true;
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
    const reviewChangesSummary = useMemo(() => getReviewChangesSummary(messages), [messages]);
    const reviewChangesLifecycleLabel = useMemo(
        () => getReviewChangesLifecycleLabel(messages),
        [messages]
    );
    const hasAppliedUncommittedChanges =
        reviewChangesLifecycleLabel === "Applied uncommitted changes";

    if (reviewChangesSummary.commandCount === 0 || !reviewChangesLifecycleLabel) return null;

    const keepReviewChanges = async () => {
        if (isClearing) return;
        setIsClearing(true);
        try {
            const runtime = assistantRuntime.threads.getById(threadId);
            await revertAndKeepReviewChanges(threadId, runtime);
            setIsOpen(false);
        } catch (error) {
            await showReviewChangesOperationError(
                "Failed to revert applied uncommitted changes",
                error
            );
        } finally {
            setIsClearing(false);
        }
    };

    const discardReviewChanges = async () => {
        if (isClearing) return;
        setIsClearing(true);
        try {
            const runtime = assistantRuntime.threads.getById(threadId);
            const didDiscard = await revertAndDiscardReviewChanges(threadId, runtime);
            if (didDiscard) setIsOpen(false);
        } catch (error) {
            await showReviewChangesOperationError(
                "Failed to revert and discard uncommitted changes",
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
                    <div className="font-medium">{reviewChangesLifecycleLabel}</div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Uncommitted commands</span>
                        <span className="font-mono tabular-nums">
                            {reviewChangesSummary.commandCount}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Changed pages</span>
                        <span className="font-mono tabular-nums">
                            {reviewChangesSummary.changedPageCount}
                        </span>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full gap-2"
                        disabled={isClearing || !hasAppliedUncommittedChanges}
                        onClick={() => void keepReviewChanges()}>
                        <Undo2Icon className="size-3.5" />
                        Revert
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        disabled={isClearing}
                        onClick={() => void discardReviewChanges()}>
                        <Trash2Icon className="size-3.5" />
                        Revert and discard
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

async function persistReviewChangesTrackerArtifact(
    threadId: string,
    runtime: ThreadRuntime,
    locatedTracker: LocatedLogseqReversibleTransactionTracker,
    persistTrackerArtifact: typeof persistLogseqReversibleTransactionTrackerArtifact
): Promise<void> {
    await persistTrackerArtifact({
        threadId,
        runtime,
        location: locatedTracker,
        tracker: locatedTracker.tracker
    });
}

function appendSyntheticToolResponse(
    runtime: ThreadRuntime,
    toolName: string,
    args: ReadonlyJSONObject,
    output: unknown
): void {
    const response = ToolResponse.toResponse(output);
    runtime.append({
        role: "assistant",
        startRun: false,
        content: [
            {
                type: "tool-call",
                toolCallId: generateId(),
                toolName,
                args,
                argsText: JSON.stringify(args),
                result: response.result,
                isError: response.isError,
                artifact: response.artifact
            }
        ]
    });
}

async function showReviewChangesRevertFailure(
    notify: ReviewChangesNotification,
    warning: string
): Promise<void> {
    try {
        await notify(warning);
    } catch (notificationError) {
        logger.error("Failed to show Logseq uncommitted-change revert warning", notificationError);
    }
}

async function showReviewChangesOperationError(operation: string, error: unknown): Promise<void> {
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
