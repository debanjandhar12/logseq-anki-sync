import type {PythonWorkerFetch} from "../workerProtocol";

export function createWorkerFetch(
    hostFetch: PythonWorkerFetch,
    originalFetch: typeof globalThis.fetch,
    allowedLocalAssetUrls: ReadonlySet<string>
): typeof globalThis.fetch {
    return async (input, init) => {
        const request = new Request(input, init);
        if (allowedLocalAssetUrls.has(request.url)) return originalFetch(request);

        const result = await hostFetch(request.url, {
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: request.body === null ? undefined : await request.text()
        });
        // Response forbids a body for these statuses, even an empty Uint8Array.
        const body =
            [204, 205, 304].includes(result.status) || request.method === "HEAD"
                ? null
                : result.body;
        const response = new Response(body, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers
        });
        Object.defineProperty(response, "url", {value: result.url});
        return response;
    };
}
