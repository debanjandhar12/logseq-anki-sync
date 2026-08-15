const activeRunCounts = new Map<string, number>();

/**
 * Tracks the physical adapter run independently from assistant-ui's public message-derived state.
 * During frontend tool execution a message can require action while its adapter is still active.
 */
export function trackThreadRun(threadId: string): () => void {
    activeRunCounts.set(threadId, (activeRunCounts.get(threadId) ?? 0) + 1);
    let didEnd = false;

    return () => {
        if (didEnd) return;
        didEnd = true;

        const remainingRuns = (activeRunCounts.get(threadId) ?? 1) - 1;
        if (remainingRuns > 0) {
            activeRunCounts.set(threadId, remainingRuns);
        } else {
            activeRunCounts.delete(threadId);
        }
    };
}

export function isThreadRunActive(threadId: string): boolean {
    return (activeRunCounts.get(threadId) ?? 0) > 0;
}
