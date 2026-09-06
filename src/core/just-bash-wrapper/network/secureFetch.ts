import type {SecureFetch} from "just-bash";
import {LOGSEQ_PROXY_FINAL_URL_HEADER} from "src/logseq/LogseqHttpProxy";
import {assertNetworkRequestAllowed} from "./networkPolicy";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 30_000;

export function createAllowlistedFetch(fetchImpl: typeof fetch): SecureFetch {
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

        try {
            for (let redirects = 0; ; redirects++) {
                const response = await fetchImpl(url, {
                    method,
                    headers: options.headers,
                    body: requestBody,
                    credentials: "omit",
                    redirect: "manual",
                    signal: controller.signal
                });
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
                assertNetworkRequestAllowed(finalUrl, method);
                const declaredSize = Number(response.headers.get("content-length"));
                if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
                    throw new Error("Network response exceeded the size limit.");
                }
                const responseBody = await readResponseBody(response);
                return toFetchResult(response, new URL(finalUrl), responseBody);
            }
        } finally {
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", abort);
        }
    };
}

async function readResponseBody(response: Response): Promise<Uint8Array> {
    if (!response.body) return new Uint8Array(await response.arrayBuffer());

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error("Network response exceeded the size limit.");
        }
        chunks.push(value);
    }

    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return body;
}

function toFetchResult(response: Response, url: URL, body: Uint8Array) {
    const headers = Object.fromEntries(response.headers.entries());
    delete headers[LOGSEQ_PROXY_FINAL_URL_HEADER];
    return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        url: response.url || url.href
    };
}
