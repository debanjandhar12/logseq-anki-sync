type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ProxyReturnType = "text" | "arraybuffer";

type LogseqProxyResponse = {
    status: number;
    statusText?: string;
    ok: boolean;
    body: unknown;
    headers?: Record<string, string>;
};

/**
 * Replaces window.fetch to avoid electron cross-origin restrictions.
 * Does not support streaming at the moment.
 */
export class LogseqHttpProxy {
    private static originalFetch: typeof fetch | null = null;

    static init() {
        if (LogseqHttpProxy.originalFetch !== null) {
            return;
        }

        LogseqHttpProxy.originalFetch = window.fetch.bind(window);
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
            LogseqHttpProxy.fetch(input, init);
    }

    /**
     * Fetch through Logseq's host-side exper_request proxy to bypass iframe CORS restrictions.
     * The host proxy buffers responses, so this returns a normal non-streaming Response.
     */
    private static async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const request = new Request(input, init);
        const urlStr = request.url;
        const returnType = LogseqHttpProxy.getReturnType(request);

        if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            return LogseqHttpProxy.getOriginalFetch()(input, init);
        }

        if (!LogseqHttpProxy.hasExecCallableAPIAsync()) {
            return LogseqHttpProxy.getOriginalFetch()(input, init);
        }

        const result = await LogseqHttpProxy.experRequest({
            url: urlStr,
            method: LogseqHttpProxy.getMethod(request.method),
            headers: LogseqHttpProxy.getHeaders(request.headers),
            body: await LogseqHttpProxy.getRequestBody(request),
            returnType
        });

        return LogseqHttpProxy.toResponse(result, returnType);
    }

    private static getOriginalFetch(): typeof fetch {
        if (LogseqHttpProxy.originalFetch === null) {
            throw new Error("LogseqHttpProxy not initialized");
        }

        return LogseqHttpProxy.originalFetch;
    }

    private static hasExecCallableAPIAsync(): boolean {
        return (
            typeof (logseq as {_execCallableAPIAsync?: unknown})._execCallableAPIAsync ===
            "function"
        );
    }

    private static async experRequest(options: {
        url: string;
        method: HttpMethod;
        headers: Record<string, string>;
        body?: unknown;
        returnType: ProxyReturnType;
    }): Promise<unknown> {
        const host = logseq as typeof logseq & {
            _execCallableAPIAsync: (
                ...args: unknown[]
            ) => Promise<string | number | null | undefined>;
            Request: {once: (event: string, callback: (payload: unknown) => void) => void};
        };

        const requestId = await host._execCallableAPIAsync("exper_request", host.baseInfo.id, {
            url: options.url,
            method: options.method,
            headers: options.headers,
            data: options.body,
            returnType: options.returnType,
            includeResponse: true
        });

        if (!requestId) {
            throw new Error("Logseq exper_request is not available");
        }

        return new Promise((resolve) => {
            host.Request.once(`task_callback_${requestId}`, resolve);
        });
    }

    private static toResponse(result: unknown, returnType: ProxyReturnType): Response {
        if (LogseqHttpProxy.isProxyResponse(result)) {
            return new Response(LogseqHttpProxy.getResponseBody(result.body, returnType), {
                status: result.status,
                statusText: result.statusText,
                headers: result.headers
            });
        }

        return new Response(LogseqHttpProxy.getResponseBody(result, returnType), {
            status: 200,
            statusText: "OK"
        });
    }

    private static isProxyResponse(value: unknown): value is LogseqProxyResponse {
        return (
            typeof value === "object" && value !== null && typeof (value as any).status === "number"
        );
    }

    private static getMethod(requestMethod: string): HttpMethod {
        const method = requestMethod.toUpperCase();
        if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
            return method as HttpMethod;
        }
        throw new Error(`Unsupported HTTP method for Logseq exper_request: ${method}`);
    }

    private static getReturnType(request: Request): ProxyReturnType {
        return request.method === "GET" && new URL(request.url).pathname.endsWith(".wasm")
            ? "arraybuffer"
            : "text";
    }

    private static getHeaders(headersInit?: HeadersInit): Record<string, string> {
        return Object.fromEntries(new Headers(headersInit).entries());
    }

    private static async getRequestBody(request: Request): Promise<unknown> {
        if (request.body === null) return undefined;

        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            return LogseqHttpProxy.getBody(await request.clone().text());
        }
        if (contentType.startsWith("text/")) {
            return await request.clone().text();
        }
        return await request.clone().arrayBuffer();
    }

    private static getBody(body: BodyInit | null | undefined): unknown {
        if (typeof body !== "string") {
            return body;
        }

        try {
            return JSON.parse(body);
        } catch {
            return body;
        }
    }

    private static getBodyString(body: unknown): BodyInit | null | undefined {
        if (body === null || body === undefined || typeof body === "string") {
            return body as BodyInit | null | undefined;
        }

        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            return body as BodyInit;
        }

        return JSON.stringify(body);
    }

    private static getResponseBody(
        body: unknown,
        returnType: ProxyReturnType
    ): BodyInit | null | undefined {
        if (returnType === "text") return LogseqHttpProxy.getBodyString(body);
        if (body instanceof ArrayBuffer) return body;
        if (ArrayBuffer.isView(body)) {
            return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
        }
        if (Array.isArray(body) && body.every((value) => Number.isInteger(value))) {
            return new Uint8Array(body);
        }
        if (
            typeof body === "object" &&
            body !== null &&
            Array.isArray((body as {data?: unknown}).data)
        ) {
            return new Uint8Array((body as {data: number[]}).data);
        }
        throw new Error("Logseq exper_request returned an invalid binary response");
    }
}
