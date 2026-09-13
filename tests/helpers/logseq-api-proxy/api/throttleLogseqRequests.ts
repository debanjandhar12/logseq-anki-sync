import AsyncLock from "async-lock";

const LOGSEQ_REQUEST_INTERVAL_MS = 100;
const throttledFetches = new WeakSet<typeof fetch>();

/** Serializes Logseq requests with at least 100ms between starts. */
export function throttleLogseqRequests(logseqApiUrl: string): void {
    const originalFetch = globalThis.fetch;
    if (throttledFetches.has(originalFetch)) return;

    const lock = new AsyncLock({maxPending: Infinity});
    let nextStartAt = 0;
    const queuedFetch: typeof fetch = async (input, init) => {
        const requestUrl =
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (requestUrl !== logseqApiUrl) return originalFetch(input, init);

        return lock.acquire(logseqApiUrl, async () => {
            const delay = Math.max(0, nextStartAt - Date.now());
            if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            nextStartAt = Date.now() + LOGSEQ_REQUEST_INTERVAL_MS;
            return originalFetch(input, init);
        });
    };

    throttledFetches.add(queuedFetch);
    globalThis.fetch = queuedFetch;
}
