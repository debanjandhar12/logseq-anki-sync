import "@logseq/libs";
import proxyLogseq from "logseq-proxy";

const LOGSEQ_REQUEST_INTERVAL_MS = 100;
const LOGSEQ_REQUEST_LOCK_NAME = "logseq-test-api-request";

interface LogseqRequestQueue {
    tail: Promise<void>;
    nextStartAt: number;
}

const queueByFetch = new WeakMap<typeof globalThis.fetch, LogseqRequestQueue>();

interface LogseqProxyWrapperOptions {
    settings?: Record<string, unknown>;
    apiServer?: string;
    apiToken?: string;
}

export function setupLogseqProxy({
    settings = {},
    apiServer = process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
    apiToken = process.env.LOGSEQ_API_TOKEN || ""
}: LogseqProxyWrapperOptions = {}): void {
    installLogseqRequestQueue(`${apiServer}/api`);

    proxyLogseq({
        settings,
        config: {apiServer, apiToken}
    });

    if (typeof logseq === "undefined") return;

    logseq.baseInfo ??= {id: "browser-test"} as typeof logseq.baseInfo;
    logseq.showMainUI = () => undefined;
    logseq.hideMainUI = () => undefined;
    logseq.App = new Proxy(logseq.App, {
        get(target, property, receiver) {
            if (property === "onThemeChanged" || property === "onThemeModeChanged") {
                return () => () => undefined;
            }
            return Reflect.get(target, property, receiver);
        }
    });
}

function installLogseqRequestQueue(logseqApiUrl: string): void {
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
