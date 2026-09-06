import RELEASE_ASYNCIFY from "@jitl/quickjs-wasmfile-release-asyncify";
import {releaseProxy} from "comlink";
import {
    newQuickJSAsyncWASMModuleFromVariant,
    type QuickJSContext,
    type QuickJSHandle
} from "quickjs-emscripten-core";
import type {
    QuickJsExecutionResult,
    QuickJsWorkerExecution,
    QuickJsWorkerFetch
} from "./workerProtocol";

const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_MODULES = 64;
const MAX_MODULE_SOURCE_BYTES = 10 * 1024 * 1024;
const PROCESS_EXIT_PREFIX = "__QJS_PROCESS_EXIT__";

type ReleasableWorkerFetch = QuickJsWorkerFetch & {[releaseProxy]?: () => void};
let preparedModule: Awaited<ReturnType<typeof newQuickJSAsyncWASMModuleFromVariant>> | undefined;

export async function initializeQuickJsWorker(): Promise<void> {
    preparedModule = await newQuickJSAsyncWASMModuleFromVariant(RELEASE_ASYNCIFY);
}

function printable(context: QuickJSContext, handle: QuickJSHandle): string {
    const value = context.dump(handle);
    return typeof value === "string" ? value : JSON.stringify(value);
}

function installFunction(
    context: QuickJSContext,
    name: string,
    implementation: (...args: QuickJSHandle[]) => QuickJSHandle | {error: QuickJSHandle} | undefined
): void {
    const fn = context.newFunction(name, implementation);
    context.setProp(context.global, name, fn);
    fn.dispose();
}

export async function executeQuickJsInWorker(
    options: QuickJsWorkerExecution,
    fetch: QuickJsWorkerFetch
): Promise<QuickJsExecutionResult> {
    // Each worker executes once. A fresh module also contains asyncify state if execution fails.
    const quickJsModule =
        preparedModule ?? (await newQuickJSAsyncWASMModuleFromVariant(RELEASE_ASYNCIFY));
    preparedModule = undefined;
    const runtime = quickJsModule.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(STACK_LIMIT_BYTES);
    const context = runtime.newContext();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    const pendingFetches = new Set<() => void>();
    const moduleSources = new Map<string, string>();
    let moduleSourceBytes = 0;

    const appendOutput = (current: string, value: string): string => {
        const next = current + value;
        if (new TextEncoder().encode(next).byteLength > MAX_OUTPUT_BYTES) {
            throw new Error("output exceeded 1 MiB");
        }
        return next;
    };

    try {
        runtime.setModuleLoader(
            async (moduleName) => {
                if (!moduleName) {
                    throw new Error(
                        "module import denied: use a full HTTPS URL instead of a bare specifier"
                    );
                }
                const cached = moduleSources.get(moduleName);
                if (cached != null) return cached;
                if (moduleSources.size >= MAX_MODULES) {
                    throw new Error(`module graph exceeded ${MAX_MODULES} modules`);
                }

                const response = JSON.parse(await fetch(moduleName, {method: "GET"})) as {
                    status: number;
                    statusText: string;
                    body: string;
                    url: string;
                };
                if (response.status < 200 || response.status >= 300) {
                    throw new Error(
                        `failed to load module ${JSON.stringify(moduleName)}: ${response.status} ${response.statusText}`
                    );
                }
                if (normalizeModuleUrl(response.url) !== moduleName) {
                    throw new Error(
                        `module redirect denied: ${JSON.stringify(moduleName)} redirected to ${JSON.stringify(response.url)}`
                    );
                }

                moduleSourceBytes += new TextEncoder().encode(response.body).byteLength;
                if (moduleSourceBytes > MAX_MODULE_SOURCE_BYTES) {
                    throw new Error("module graph source exceeded 10 MiB");
                }
                moduleSources.set(moduleName, response.body);
                return response.body;
            },
            (baseModuleName, requestedName) =>
                normalizeModuleSpecifier(baseModuleName, requestedName)
        );

        installFunction(context, "__stdout", (...args) => {
            try {
                stdout = appendOutput(
                    stdout,
                    `${args.map((arg) => printable(context, arg)).join(" ")}\n`
                );
                return context.undefined;
            } catch (error) {
                return {error: context.newError((error as Error).message)};
            }
        });
        installFunction(context, "__stderr", (...args) => {
            try {
                stderr = appendOutput(
                    stderr,
                    `${args.map((arg) => printable(context, arg)).join(" ")}\n`
                );
                return context.undefined;
            } catch (error) {
                return {error: context.newError((error as Error).message)};
            }
        });
        installFunction(context, "__parseUrl", (input, base) => {
            const parsed = new URL(
                context.getString(input),
                base && context.typeof(base) !== "undefined" ? context.getString(base) : undefined
            );
            return context.newString(
                JSON.stringify({
                    href: parsed.href,
                    protocol: parsed.protocol,
                    hostname: parsed.hostname,
                    pathname: parsed.pathname,
                    search: parsed.search,
                    hash: parsed.hash,
                    searchParams: [...parsed.searchParams.entries()]
                })
            );
        });
        installFunction(context, "__exit", (code) => {
            exitCode = code ? context.getNumber(code) : 0;
            return {error: context.newError(`${PROCESS_EXIT_PREFIX}${exitCode}`)};
        });

        const hostFetch = context.newFunction("__hostFetch", (url, init) => {
            const requestUrl = context.getString(url);
            const requestOptions = (init ? context.dump(init) : {}) as Record<string, unknown>;
            const promise = context.newPromise();
            let settled = false;
            const settle = (value?: string, error?: unknown) => {
                if (settled) return;
                settled = true;
                pendingFetches.delete(cancel);
                if (!context.alive || !promise.alive) return;
                const handle = error
                    ? context.newError(error instanceof Error ? error.message : String(error))
                    : context.newString(value ?? "");
                if (error) promise.reject(handle);
                else promise.resolve(handle);
                handle.dispose();
            };
            const cancel = () => settle(undefined, new Error("fetch cancelled"));
            pendingFetches.add(cancel);
            void fetch(requestUrl, requestOptions).then(
                (value) => settle(value),
                (error) => settle(undefined, error)
            );
            void promise.settled.then(() => {
                try {
                    if (!runtime.alive) return;
                    const pendingJobs = runtime.executePendingJobs();
                    if (pendingJobs.error) pendingJobs.error.dispose();
                } finally {
                    promise.dispose();
                }
            });
            return promise.handle;
        });
        context.setProp(context.global, "__hostFetch", hostFetch);
        hostFetch.dispose();

        const bootstrapResult = await context.evalCodeAsync(
            createBootstrap(options),
            "<qjs-bootstrap>"
        );
        if ("error" in bootstrapResult) {
            const message = printable(context, bootstrapResult.error);
            bootstrapResult.error.dispose();
            return {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
        }
        bootstrapResult.value.dispose();

        const result = await context.evalCodeAsync(
            `${options.code}\nif (globalThis.__utilityPromise) await globalThis.__utilityPromise;`,
            options.fileName,
            {type: "module"}
        );
        if ("error" in result) return guestError(context, result.error, stdout, stderr, exitCode);

        const execution = context.resolvePromise(result.value);
        result.value.dispose();
        let settled = false;
        void execution.finally(() => {
            settled = true;
        });
        while (!settled) {
            const pendingJobs = runtime.executePendingJobs();
            if (pendingJobs.error) {
                return guestError(context, pendingJobs.error, stdout, stderr, exitCode);
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const completion = await execution;
        if ("error" in completion) {
            return guestError(context, completion.error, stdout, stderr, exitCode);
        }
        completion.value.dispose();
        return {stdout, stderr, exitCode};
    } finally {
        const hadPendingFetches = pendingFetches.size > 0;
        for (const cancel of [...pendingFetches]) cancel();
        if (hadPendingFetches) await new Promise((resolve) => setTimeout(resolve, 0));
        context.dispose();
        // quickjs-emscripten 0.32.0 removes async runtime callbacks before finalizers run.
        // Worker termination releases the one-shot runtime without invoking that broken path.
        try {
            (fetch as ReleasableWorkerFetch)[releaseProxy]?.();
        } catch {
            // Worker termination remains the authoritative callback cleanup.
        }
    }
}

function normalizeModuleSpecifier(baseModuleName: string, requestedName: string): string {
    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(requestedName)) {
        return normalizeModuleUrl(requestedName);
    }
    if (!requestedName.startsWith(".") && !requestedName.startsWith("/")) {
        throw new Error(
            `bare module specifier denied: ${JSON.stringify(requestedName)}; use a full HTTPS URL`
        );
    }
    return normalizeModuleUrl(new URL(requestedName, normalizeModuleUrl(baseModuleName)).href);
}

function normalizeModuleUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`invalid module URL: ${JSON.stringify(value)}`);
    }
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
    ) {
        throw new Error(`module import denied: ${JSON.stringify(value)}`);
    }
    url.hash = "";
    return url.href;
}

function guestError(
    context: QuickJSContext,
    error: QuickJSHandle,
    stdout: string,
    stderr: string,
    exitCode: number
): QuickJsExecutionResult {
    const message = printable(context, error);
    error.dispose();
    return message.includes(PROCESS_EXIT_PREFIX)
        ? {stdout, stderr, exitCode}
        : {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
}

function createBootstrap(options: QuickJsWorkerExecution): string {
    return `
class URLSearchParams {
  constructor(entries = []) { this.entries_ = Array.from(entries); }
  get(name) { const found = this.entries_.find(([key]) => key === String(name)); return found ? found[1] : null; }
  entries() { return this.entries_[Symbol.iterator](); }
  [Symbol.iterator]() { return this.entries(); }
}
class URL {
  constructor(input, base) {
    const value = JSON.parse(__parseUrl(String(input), base === undefined ? undefined : String(base)));
    Object.assign(this, value);
    this.searchParams = new URLSearchParams(value.searchParams);
  }
  toString() { return this.href; }
}
class Response {
  constructor(value) { Object.assign(this, value); this.ok = this.status >= 200 && this.status < 300; }
  text() { return Promise.resolve(this.body); }
  json() { return Promise.resolve(JSON.parse(this.body)); }
}
globalThis.fetch = async (url, init) => new Response(JSON.parse(await __hostFetch(String(url), init || {})));
globalThis.console = Object.freeze({log: (...args) => __stdout(...args), error: (...args) => __stderr(...args), warn: (...args) => __stderr(...args)});
globalThis.process = Object.freeze({argv: ${JSON.stringify(["qjs", options.fileName, ...options.args])}, env: Object.freeze(${JSON.stringify(options.env)}), cwd: () => ${JSON.stringify(options.cwd)}, exit: __exit});
`;
}
