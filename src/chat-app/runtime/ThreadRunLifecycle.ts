const activeRunCounts = new Map<string, number>();

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
