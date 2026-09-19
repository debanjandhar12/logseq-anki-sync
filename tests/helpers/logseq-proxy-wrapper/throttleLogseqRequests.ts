const LOGSEQ_REQUEST_INTERVAL_MS = 100;
const LOGSEQ_REQUEST_LOCK_NAME = "logseq-test-api-request";

interface LogseqRequestQueue {
    tail: Promise<void>;
    nextStartAt: number;
}

const queueByFetch = new WeakMap<typeof globalThis.fetch, LogseqRequestQueue>();

export function throttleLogseqRequests(logseqApiUrl: string): void {
    const originalFetch = globalThis.fetch;
    if (queueByFetch.has(originalFetch)) return;

    const queue: LogseqRequestQueue = {
        tail: Promise.resolve(),
        nextStartAt: 0
    };

    const queuedFetch: typeof fetch = (input, init) => {
        const requestUrl =
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (requestUrl !== logseqApiUrl) return originalFetch(input, init);

        const request = queue.tail.then(() => {
            if (
                typeof navigator !== "undefined" &&
                typeof navigator.locks !== "undefined" &&
                typeof navigator.locks.request === "function"
            ) {
                return navigator.locks.request(LOGSEQ_REQUEST_LOCK_NAME, () =>
                    runThrottledRequest()
                );
            }
            return runThrottledRequest();
        });

        async function runThrottledRequest(): Promise<Response> {
            const delay = Math.max(0, queue.nextStartAt - Date.now());
            if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            const requestStartedAt = Date.now();
            queue.nextStartAt = requestStartedAt + LOGSEQ_REQUEST_INTERVAL_MS;
            const response = await originalFetch(input, init);
            const remainingInterval = Math.max(
                0,
                requestStartedAt + LOGSEQ_REQUEST_INTERVAL_MS - Date.now()
            );
            if (remainingInterval > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingInterval));
            }
            return response;
        }

        queue.tail = request.then(
            () => undefined,
            () => undefined
        );
        return request;
    };

    queueByFetch.set(originalFetch, queue);
    globalThis.fetch = queuedFetch;
}
