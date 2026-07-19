import {type ThreadRuntime, useAssistantRuntime, useAuiState} from "@assistant-ui/react";
import debounce from "lodash/debounce";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {LogseqReversibleTransactionTrackerSerializer} from "src/core/logseq-reversible-transaction-tracker";
import {createLogger, LoggerCategory} from "src/logger";
import {CHAT_APP_LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_REVERT_DELAY} from "../../constants";
import {persistLogseqReversibleTransactionTrackerArtifact} from "../runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {
    findLastLogseqReversibleTransactionTracker,
    type LocatedLogseqReversibleTransactionTracker
} from "../tools/transaction/getLastLogseqReversibleTransactionTracker";

const COUNTDOWN_INTERVAL_MS = 250;
const logger = createLogger(LoggerCategory.CHAT_UI);

interface ActiveTransactionSnapshot {
    threadId: string;
    branchMessageIds: readonly string[];
    locatedTracker: LocatedLogseqReversibleTransactionTracker | null;
    artifactKey: string | null;
}

const hasAppliedTemporaryChanges = ({
    tracker
}: LocatedLogseqReversibleTransactionTracker): boolean => tracker.hasAppliedGraphMutations();

const getArtifactKey = (
    threadId: string,
    locatedTracker: LocatedLogseqReversibleTransactionTracker | null
): string | null =>
    locatedTracker
        ? `${threadId}:${locatedTracker.messageId}:${locatedTracker.toolCallId}:${JSON.stringify(
              LogseqReversibleTransactionTrackerSerializer.serialize(locatedTracker.tracker)
          )}`
        : null;

export const didActiveConversationChange = (
    previous: Pick<ActiveTransactionSnapshot, "threadId" | "branchMessageIds">,
    current: Pick<ActiveTransactionSnapshot, "threadId" | "branchMessageIds">
): boolean => {
    if (previous.threadId !== current.threadId) return true;
    if (current.branchMessageIds.length < previous.branchMessageIds.length) return true;
    return !previous.branchMessageIds.every(
        (messageId, index) => current.branchMessageIds[index] === messageId
    );
};

export function useLogseqReversibleTransactionLifecycle() {
    const assistantRuntime = useAssistantRuntime();
    const messages = useAuiState((state) => state.thread.messages);
    const isThreadLoading = useAuiState((state) => state.thread.isLoading);
    const isThreadRunning = useAuiState((state) => state.thread.isRunning);
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const [deadline, setDeadline] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const threadIdRef = useRef(threadId);
    const isThreadRunningRef = useRef(isThreadRunning);
    const activeSnapshotRef = useRef<ActiveTransactionSnapshot | null>(null);
    const observedLoadingRef = useRef(isThreadLoading);
    const cleanupQueueRef = useRef(Promise.resolve());
    const queuedTrackersRef = useRef(
        new WeakSet<LocatedLogseqReversibleTransactionTracker["tracker"]>()
    );

    threadIdRef.current = threadId;
    isThreadRunningRef.current = isThreadRunning;

    const getThreadRuntime = useCallback(
        (targetThreadId: string): ThreadRuntime | undefined => {
            try {
                return assistantRuntime.threads.getById(targetThreadId);
            } catch {
                return undefined;
            }
        },
        [assistantRuntime]
    );

    const persistTrackerArtifact = useCallback(
        async (locatedTracker: LocatedLogseqReversibleTransactionTracker) => {
            const targetThreadId = threadIdRef.current;
            await persistLogseqReversibleTransactionTrackerArtifact({
                threadId: targetThreadId,
                runtime: getThreadRuntime(targetThreadId),
                location: locatedTracker,
                tracker: locatedTracker.tracker
            });
        },
        [getThreadRuntime]
    );

    const enqueueSnapshotRevert = useCallback(
        (snapshot: ActiveTransactionSnapshot, failureMessage: string): Promise<void> => {
            const {artifactKey, locatedTracker, threadId: snapshotThreadId} = snapshot;
            if (
                !artifactKey ||
                !locatedTracker ||
                !hasAppliedTemporaryChanges(locatedTracker) ||
                queuedTrackersRef.current.has(locatedTracker.tracker)
            ) {
                return cleanupQueueRef.current;
            }

            queuedTrackersRef.current.add(locatedTracker.tracker);
            const cleanup = cleanupQueueRef.current.then(async () => {
                let revertFailed = false;
                try {
                    await locatedTracker.tracker.revertImmediately();
                } catch (error) {
                    revertFailed = true;
                    logger.error(failureMessage, error);
                    await logseq.UI.showMsg(
                        `${failureMessage}. Clearing staged changes so you can continue.`,
                        "error"
                    );
                    locatedTracker.tracker.clear();
                }

                try {
                    await persistLogseqReversibleTransactionTrackerArtifact({
                        threadId: snapshotThreadId,
                        runtime: getThreadRuntime(snapshotThreadId),
                        location: locatedTracker,
                        tracker: locatedTracker.tracker
                    });
                } catch (error) {
                    if (!revertFailed) {
                        queuedTrackersRef.current.delete(locatedTracker.tracker);
                    }
                    logger.error("Failed to persist Logseq transaction cleanup", error);
                    await logseq.UI.showMsg(
                        "Failed to persist Logseq transaction cleanup",
                        "error"
                    );
                }
            });
            cleanupQueueRef.current = cleanup;
            return cleanup;
        },
        [getThreadRuntime]
    );

    const scheduledRevert = useMemo(() => {
        const debouncedRevert = debounce((snapshot: ActiveTransactionSnapshot) => {
            if (isThreadRunningRef.current) {
                // Do not reset staged graph changes while the current tool loop is still running:
                // later tools may still rely on the in-memory assistant message artifact.
                // Note: We allow revert during requires-action state.
                setDeadline(null);
                setRemainingSeconds(null);
                debouncedRevert(snapshot);
                return;
            }

            setDeadline(null);
            setRemainingSeconds(null);
            void enqueueSnapshotRevert(snapshot, "Failed to revert temporary Logseq changes");
        }, CHAT_APP_LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_REVERT_DELAY);

        return debouncedRevert;
    }, [enqueueSnapshotRevert]);

    const cancelScheduledRevert = useCallback(() => {
        scheduledRevert.cancel();
        setDeadline(null);
        setRemainingSeconds(null);
    }, [scheduledRevert]);

    useEffect(() => {
        if (deadline === null) return;
        const updateCountdown = () => {
            setRemainingSeconds(Math.max(1, Math.ceil((deadline - Date.now()) / 1000)));
        };
        updateCountdown();
        const interval = window.setInterval(updateCountdown, COUNTDOWN_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [deadline]);

    useEffect(() => {
        if (isThreadLoading) {
            observedLoadingRef.current = true;
            return;
        }

        const didFinishLoading = observedLoadingRef.current;
        observedLoadingRef.current = false;

        const foundTracker = findLastLogseqReversibleTransactionTracker(messages);
        const foundArtifactKey = getArtifactKey(threadId, foundTracker);
        const previousSnapshot = activeSnapshotRef.current;
        const locatedTracker =
            foundArtifactKey === previousSnapshot?.artifactKey
                ? previousSnapshot.locatedTracker
                : foundTracker;
        const currentSnapshot: ActiveTransactionSnapshot = {
            threadId,
            branchMessageIds: messages.map((message) => message.id),
            locatedTracker,
            artifactKey: foundArtifactKey
        };
        activeSnapshotRef.current = currentSnapshot;

        if (!previousSnapshot) {
            cancelScheduledRevert();
            void enqueueSnapshotRevert(
                currentSnapshot,
                "Failed to recover applied temporary Logseq changes"
            );
            return;
        }

        if (didActiveConversationChange(previousSnapshot, currentSnapshot)) {
            cancelScheduledRevert();
            void enqueueSnapshotRevert(
                previousSnapshot,
                "Failed to revert temporary Logseq changes after navigation"
            );
            void enqueueSnapshotRevert(
                currentSnapshot,
                "Failed to recover applied temporary Logseq changes"
            );
            return;
        }

        if (didFinishLoading) {
            cancelScheduledRevert();
            void enqueueSnapshotRevert(
                currentSnapshot,
                "Failed to recover applied temporary Logseq changes"
            );
            return;
        }

        if (currentSnapshot.artifactKey === previousSnapshot.artifactKey) return;

        cancelScheduledRevert();
        if (!locatedTracker || !hasAppliedTemporaryChanges(locatedTracker)) return;

        const nextDeadline =
            Date.now() + CHAT_APP_LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_REVERT_DELAY;
        setDeadline(nextDeadline);
        setRemainingSeconds(
            Math.ceil(CHAT_APP_LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_REVERT_DELAY / 1000)
        );
        scheduledRevert(currentSnapshot);
    }, [
        messages,
        isThreadLoading,
        threadId,
        cancelScheduledRevert,
        enqueueSnapshotRevert,
        scheduledRevert
    ]);

    useEffect(() => {
        return () => {
            scheduledRevert.cancel();
            const activeSnapshot = activeSnapshotRef.current;
            if (activeSnapshot) {
                void enqueueSnapshotRevert(
                    activeSnapshot,
                    "Failed to revert temporary Logseq changes during unmount"
                );
            }
        };
    }, [scheduledRevert, enqueueSnapshotRevert]);

    return {
        hasTemporaryChanges: deadline !== null,
        remainingSeconds,
        cancelScheduledRevert,
        persistTrackerArtifact
    };
}
