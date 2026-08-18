import {useAssistantRuntime, useAuiState} from "@assistant-ui/react";
import {useCallback, useSyncExternalStore} from "react";

export const useThreadListItemIsRunning = () => {
    const threadId = useAuiState((state) => state.threadListItem.id);
    const assistantRuntime = useAssistantRuntime();
    const getThreadRuntime = useCallback(
        () => assistantRuntime.threads.getById(threadId),
        [assistantRuntime, threadId]
    );
    const getSnapshot = useCallback(() => {
        try {
            return getThreadRuntime().getState().isRunning;
        } catch {
            return false;
        }
    }, [getThreadRuntime]);
    const subscribe = useCallback(
        (notify: () => void) => {
            let threadUnsubscribe: (() => void) | undefined;
            let disposed = false;

            const rebindThreadSubscription = () => {
                threadUnsubscribe?.();
                threadUnsubscribe = undefined;
                if (disposed) return;

                try {
                    const threadRuntime = getThreadRuntime();
                    threadRuntime.getState();
                    threadUnsubscribe = threadRuntime.subscribe(notify);
                } catch {
                    // Persisted threads do not have a runtime until they are opened.
                }
                notify();
            };
            const threadListUnsubscribe =
                assistantRuntime.threads.subscribe(rebindThreadSubscription);
            rebindThreadSubscription();

            return () => {
                disposed = true;
                threadUnsubscribe?.();
                threadListUnsubscribe?.();
            };
        },
        [assistantRuntime, getThreadRuntime]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
