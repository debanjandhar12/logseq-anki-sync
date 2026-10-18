const runsByThread = new Map<string, Set<ThreadRunControl>>();
const runsBySignal = new WeakMap<AbortSignal, ThreadRunControl>();

interface ThreadRunControl {
    isExecutingTool: boolean;
    stopRequested: boolean;
}

export function getThreadRunControl(signal: AbortSignal): ThreadRunControl | undefined {
    return runsBySignal.get(signal);
}

/** Keeps the native signal live until the active tool's result has reached LocalRuntime. */
export function requestThreadRunStop(threadId: string): boolean {
    const runs = runsByThread.get(threadId);
    if (!runs || ![...runs].some((run) => run.isExecutingTool || run.stopRequested)) return false;
    for (const run of runs) run.stopRequested = true;
    return true;
}

/**
 * Tracks the physical adapter run independently from assistant-ui's public message-derived state.
 * During frontend tool execution a message can require action while its adapter is still active.
 */
export function trackThreadRun(threadId: string, signal?: AbortSignal): () => void {
    const control: ThreadRunControl = {isExecutingTool: false, stopRequested: false};
    const runs = runsByThread.get(threadId) ?? new Set<ThreadRunControl>();
    runs.add(control);
    runsByThread.set(threadId, runs);
    if (signal) runsBySignal.set(signal, control);
    return () => {
        if (!runs.delete(control)) return;
        if (runs.size === 0) runsByThread.delete(threadId);
        if (signal) runsBySignal.delete(signal);
    };
}

export function isThreadRunActive(threadId: string): boolean {
    return runsByThread.has(threadId);
}
