import {type ThreadRuntime, useAssistantRuntime, useAuiState} from "@assistant-ui/react";
import {useCallback} from "react";
import {persistLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/runtime/persistLogseqReversibleTransactionTrackerArtifact";
import type {LocatedLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";

export function usePersistLogseqTrackerArtifact() {
    const assistantRuntime = useAssistantRuntime();
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;

    return useCallback(
        async (locatedTracker: LocatedLogseqReversibleTransactionTracker): Promise<void> => {
            let runtime: ThreadRuntime | undefined;
            try {
                runtime = assistantRuntime.threads.getById(threadId);
            } catch {
                runtime = undefined;
            }
            await persistLogseqReversibleTransactionTrackerArtifact({
                threadId,
                runtime,
                location: locatedTracker,
                tracker: locatedTracker.tracker
            });
        },
        [assistantRuntime, threadId]
    );
}
