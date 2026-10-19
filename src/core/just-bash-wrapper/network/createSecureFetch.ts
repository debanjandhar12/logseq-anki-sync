import type {SecureFetch} from "just-bash";
import {LOGSEQ_PROXY_FINAL_URL_HEADER} from "src/logseq/LogseqHttpProxy";
import {assertNetworkRequestAllowed} from "./policy/assertNetworkRequestAllowed";

const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 30_000;

export function createSecureFetch(fetchImpl: typeof fetch): SecureFetch {
    return async (input, options = {}) => {
        let method = (options.method ?? "GET").toUpperCase();
        let requestBody = options.body;
        let url = assertNetworkRequestAllowed(input, method);
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            Math.min(options.timeoutMs ?? TIMEOUT_MS, TIMEOUT_MS)
        );
        const abort = () => controller.abort(options.signal?.reason);
        options.signal?.addEventListener("abort", abort, {once: true});
        if (options.signal?.aborted) abort();

        try {
            for (let redirects = 0; ; redirects++) {
                const response = await withAbort(
                    () =>
                        fetchImpl(url, {
                            method,
                            headers: options.headers,
                            body: requestBody,
                            credentials: "omit",
                            redirect: "manual",
                            signal: controller.signal
                        }),
                    controller.signal
                );
                if (response.type === "opaqueredirect") {
                    throw new Error("Network redirect denied because its destination is hidden.");
                }
                const location = response.headers.get("location");
                if (location && response.status >= 300 && response.status < 400) {
                    if (options.followRedirects === false) {
                        return toFetchResult(response, url, new Uint8Array());
                    }
                    if (
                        redirects >= Math.min(options.maxRedirects ?? MAX_REDIRECTS, MAX_REDIRECTS)
                    ) {
                        throw new Error("Network request exceeded the redirect limit.");
                    }
                    if (
                        response.status === 303 ||
                        ((response.status === 301 || response.status === 302) && method === "POST")
                    ) {
                        method = "GET";
                        requestBody = undefined;
                    }
                    url = assertNetworkRequestAllowed(new URL(location, url).href, method);
                    continue;
                }

                const finalUrl =
                    response.headers.get(LOGSEQ_PROXY_FINAL_URL_HEADER) || response.url || url.href;
                const validatedFinalUrl = assertNetworkRequestAllowed(finalUrl, method);
                const responseBody = new Uint8Array(
                    await withAbort(() => response.arrayBuffer(), controller.signal)
                );
                return toFetchResult(response, validatedFinalUrl, responseBody);
            }
        } finally {
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", abort);
        }
    };
}

/** Enforce cancellation even when a buffered host transport does not observe its signal. */
async function withAbort<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();
    let abort: () => void = () => {};
    try {
        return await new Promise<T>((resolve, reject) => {
            abort = () => reject(signal.reason);
            signal.addEventListener("abort", abort, {once: true});
            Promise.resolve()
                .then(() => {
                    signal.throwIfAborted();
                    return operation();
                })
                .then(resolve, reject);
        });
    } finally {
        signal.removeEventListener("abort", abort);
    }
}

function toFetchResult(response: Response, url: URL, body: Uint8Array) {
    const headers = Object.fromEntries(response.headers.entries());
    delete headers[LOGSEQ_PROXY_FINAL_URL_HEADER];
    return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        url: url.href
    };
}
