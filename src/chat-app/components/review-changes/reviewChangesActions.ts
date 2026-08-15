import {generateId, type ThreadRuntime} from "@assistant-ui/react";
import {ToolResponse} from "assistant-stream";
import type {ReadonlyJSONObject} from "assistant-stream/utils";
import {persistLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {stopThreadRun} from "src/chat-app/runtime/thread-run";
import {LogseqClearUncommittedChangesTool} from "src/chat-app/tools/impl/LogseqClearUncommittedChangesTool";
import {
    findLastLogseqReversibleTransactionTracker,
    type LocatedLogseqReversibleTransactionTracker
} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {createLogger, LoggerCategory} from "src/logger";
import {showConfirmModal} from "src/ui/launchers/showConfirmModal";

const logger = createLogger(LoggerCategory.CHAT_UI);
type ReviewChangesNotification = (message: string) => Promise<unknown>;

export interface ReviewChangesActionDependencies {
    createDiscardTool: () => LogseqClearUncommittedChangesTool;
    notify: ReviewChangesNotification;
    persistTrackerArtifact: typeof persistLogseqReversibleTransactionTrackerArtifact;
    showConfirm: typeof showConfirmModal;
    stopThread: typeof stopThreadRun;
}

const defaultDependencies: ReviewChangesActionDependencies = {
    createDiscardTool: () => new LogseqClearUncommittedChangesTool(),
    notify: (message) => logseq.UI.showMsg(message, "error"),
    persistTrackerArtifact: persistLogseqReversibleTransactionTrackerArtifact,
    showConfirm: showConfirmModal,
    stopThread: stopThreadRun
};

export async function revertAndKeepReviewChanges(
    threadId: string,
    runtime: ThreadRuntime,
    dependencies: Pick<
        ReviewChangesActionDependencies,
        "notify" | "persistTrackerArtifact"
    > = defaultDependencies
): Promise<"retained" | "discarded"> {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(runtime.getState().messages);
    if (!locatedTracker) return "retained";

    try {
        if (locatedTracker.tracker.hasAppliedGraphMutations()) {
            await locatedTracker.tracker.revertAppliedCommands();
        }
    } catch (error) {
        const errorMessage = getErrorMessageFromErrObj(error);
        const warning = `Failed to revert applied uncommitted changes: ${errorMessage}. Uncommitted changes were discarded.`;
        logger.error("Failed to revert applied uncommitted changes while retaining them", error);
        locatedTracker.tracker.clear();
        await showRevertFailure(dependencies.notify, warning);
        await persistTracker(
            threadId,
            runtime,
            locatedTracker,
            dependencies.persistTrackerArtifact
        );
        return "discarded";
    }

    await persistTracker(threadId, runtime, locatedTracker, dependencies.persistTrackerArtifact);
    return "retained";
}

export async function revertAndDiscardReviewChanges(
    threadId: string,
    runtime: ThreadRuntime,
    dependencies: Partial<ReviewChangesActionDependencies> = {}
): Promise<boolean> {
    const actions = {...defaultDependencies, ...dependencies};
    if (runtime.getState().isRunning) {
        const result = await actions.stopThread({threadId, runtime});
        if (result.persistenceFailed) throw new Error("Failed to persist the stopped chat state");
    }

    const confirmed = await actions.showConfirm(
        "Revert applied uncommitted changes and discard all uncommitted changes?",
        {confirmText: "Revert and discard", cancelText: "Keep uncommitted changes"}
    );
    if (!confirmed) return false;

    // This later call is idempotent and also catches a run started while confirmation was open.
    const stopResult = await actions.stopThread({threadId, runtime});
    if (stopResult.persistenceFailed) {
        throw new Error("Failed to persist the stopped chat state");
    }
    const output = await actions
        .createDiscardTool()
        .execute({}, {messages: runtime.getState().messages});
    appendSyntheticToolResponse(runtime, LogseqClearUncommittedChangesTool.NAME, {}, output);
    return true;
}

async function persistTracker(
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

async function showRevertFailure(
    notify: ReviewChangesNotification,
    warning: string
): Promise<void> {
    try {
        await notify(warning);
    } catch (notificationError) {
        logger.error("Failed to show Logseq uncommitted-change revert warning", notificationError);
    }
}
