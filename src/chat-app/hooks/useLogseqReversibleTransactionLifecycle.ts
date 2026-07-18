import {type AssistantClient, useAuiState} from "@assistant-ui/react";
import debounce from "lodash/debounce";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {LogseqReversibleTransactionTrackerSerializer} from "src/core/logseq-reversible-transaction-tracker";
import {createLogger, LoggerCategory} from "src/logger";
import {persistLogseqReversibleTransactionTrackerArtifact} from "../runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {
    findLastLogseqReversibleTransactionTracker,
    type LocatedLogseqReversibleTransactionTracker
} from "../tools/transaction/getLastLogseqReversibleTransactionTracker";

const REVERT_DELAY_MS = 10_000;
const COUNTDOWN_INTERVAL_MS = 250;
const logger = createLogger(LoggerCategory.CHAT_UI);

const hasAppliedTemporaryChanges = ({
    tracker
}: LocatedLogseqReversibleTransactionTracker): boolean =>
    tracker.getAppliedCommandCount() > 0 && tracker.hasAppliedGraphMutations();

export function useLogseqReversibleTransactionLifecycle(aui: AssistantClient) {
    const messages = useAuiState((state) => state.thread.messages);
    const isThreadLoading = useAuiState((state) => state.thread.isLoading);
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const [deadline, setDeadline] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const messagesRef = useRef(messages);
    const threadIdRef = useRef(threadId);
    const observedThreadIdRef = useRef<string | null>(null);
    const observedArtifactKeyRef = useRef<string | null>(null);
    const previousBranchMessageIdsRef = useRef<readonly string[] | null>(null);

    messagesRef.current = messages;
    threadIdRef.current = threadId;

    const persistTrackerArtifact = useCallback(
        async (locatedTracker: LocatedLogseqReversibleTransactionTracker) => {
            await persistLogseqReversibleTransactionTrackerArtifact({
                aui,
                threadId: threadIdRef.current,
                location: locatedTracker,
                tracker: locatedTracker.tracker
            });
        },
        [aui]
    );

    const revertLocatedTracker = useCallback(
        async (locatedTracker: LocatedLogseqReversibleTransactionTracker) => {
            if (!hasAppliedTemporaryChanges(locatedTracker)) return;
            await locatedTracker.tracker.revertImmediately();
            await persistTrackerArtifact(locatedTracker);
        },
        [persistTrackerArtifact]
    );

    const scheduledRevert = useMemo(
        () =>
            debounce(async (locatedTracker: LocatedLogseqReversibleTransactionTracker) => {
                setDeadline(null);
                setRemainingSeconds(null);
                try {
                    await revertLocatedTracker(locatedTracker);
                } catch (error) {
                    logger.error("Failed to revert temporary Logseq changes", error);
                }
            }, REVERT_DELAY_MS),
        [revertLocatedTracker]
    );

    const cancelScheduledRevert = useCallback(() => {
        scheduledRevert.cancel();
        setDeadline(null);
        setRemainingSeconds(null);
    }, [scheduledRevert]);

    const cleanupCurrentTracker = useCallback(async () => {
        cancelScheduledRevert();
        const locatedTracker = findLastLogseqReversibleTransactionTracker(messagesRef.current);
        if (locatedTracker) await revertLocatedTracker(locatedTracker);
    }, [cancelScheduledRevert, revertLocatedTracker]);

    const cleanupBeforeNavigation = useCallback(async () => {
        aui.thread().cancelRun();
        await cleanupCurrentTracker();
    }, [aui, cleanupCurrentTracker]);

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
        if (isThreadLoading) return;

        const isLoadedThread = observedThreadIdRef.current !== threadId;
        if (isLoadedThread) {
            observedThreadIdRef.current = threadId;
            previousBranchMessageIdsRef.current = null;
            observedArtifactKeyRef.current = null;
        }

        const branchMessageIds = messages.map((message) => message.id);
        const previousBranchMessageIds = previousBranchMessageIdsRef.current;
        const isLoadedBranch =
            isLoadedThread ||
            previousBranchMessageIds === null ||
            branchMessageIds.length < previousBranchMessageIds.length ||
            !previousBranchMessageIds.every(
                (messageId, index) => branchMessageIds[index] === messageId
            );
        previousBranchMessageIdsRef.current = branchMessageIds;

        const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
        const artifactKey = locatedTracker
            ? `${locatedTracker.messageId}:${locatedTracker.toolCallId}:${JSON.stringify(
                  LogseqReversibleTransactionTrackerSerializer.serialize(locatedTracker.tracker)
              )}`
            : null;
        if (artifactKey === observedArtifactKeyRef.current && !isLoadedBranch) return;

        observedArtifactKeyRef.current = artifactKey;
        cancelScheduledRevert();

        if (!locatedTracker || !hasAppliedTemporaryChanges(locatedTracker)) return;

        if (isLoadedBranch) {
            void revertLocatedTracker(locatedTracker).catch((error) => {
                logger.error("Failed to recover applied temporary Logseq changes", error);
            });
            return;
        }

        const nextDeadline = Date.now() + REVERT_DELAY_MS;
        setDeadline(nextDeadline);
        setRemainingSeconds(Math.ceil(REVERT_DELAY_MS / 1000));
        scheduledRevert(locatedTracker);
    }, [
        messages,
        isThreadLoading,
        threadId,
        cancelScheduledRevert,
        revertLocatedTracker,
        scheduledRevert
    ]);

    useEffect(() => {
        return () => {
            scheduledRevert.cancel();
            const locatedTracker = findLastLogseqReversibleTransactionTracker(messagesRef.current);
            if (locatedTracker && hasAppliedTemporaryChanges(locatedTracker)) {
                void revertLocatedTracker(locatedTracker).catch((error) => {
                    logger.error("Failed to revert temporary Logseq changes during unmount", error);
                });
            }
        };
    }, [scheduledRevert, revertLocatedTracker]);

    return {
        hasTemporaryChanges: deadline !== null,
        remainingSeconds,
        cancelScheduledRevert,
        cleanupBeforeNavigation,
        persistTrackerArtifact
    };
}
