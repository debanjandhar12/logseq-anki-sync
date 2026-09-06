import type {SecureFetch} from "just-bash";
import {newAsyncContext, type QuickJSAsyncContext, type QuickJSHandle} from "quickjs-emscripten";

const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const EXECUTION_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const PROCESS_EXIT_PREFIX = "__QJS_PROCESS_EXIT__";

interface ExecutionOptions {
    code: string;
    fileName: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    fetch: SecureFetch;
    signal?: AbortSignal;
}

function printable(context: QuickJSAsyncContext, handle: QuickJSHandle): string {
    const value = context.dump(handle);
    return typeof value === "string" ? value : JSON.stringify(value);
}

function installFunction(
    context: QuickJSAsyncContext,
    name: string,
    implementation: (...args: QuickJSHandle[]) => QuickJSHandle | {error: QuickJSHandle} | undefined
): void {
    const fn = context.newFunction(name, implementation);
    context.setProp(context.global, name, fn);
    fn.dispose();
}

export async function executeQuickJs(options: ExecutionOptions) {
    const context = await newAsyncContext({});
    const runtime = context.runtime;
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(STACK_LIMIT_BYTES);
    const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
    runtime.setInterruptHandler(() => options.signal?.aborted === true || Date.now() >= deadline);
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    const appendOutput = (current: string, value: string): string => {
        const next = current + value;
        if (new TextEncoder().encode(next).byteLength > MAX_OUTPUT_BYTES) {
            throw new Error("output exceeded 1 MiB");
        }
        return next;
    };

    try {
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

        const hostFetch = context.newAsyncifiedFunction("__hostFetch", async (url, init) => {
            const request = init ? context.dump(init) : undefined;
            const result = await options.fetch(context.getString(url), {
                ...(typeof request === "object" && request !== null ? request : {}),
                signal: options.signal
            });
            return context.newString(
                JSON.stringify({...result, body: new TextDecoder().decode(result.body)})
            );
        });
        context.setProp(context.global, "__hostFetch", hostFetch);
        hostFetch.dispose();

        const bootstrap = createBootstrap(options);
        const bootstrapResult = await context.evalCodeAsync(bootstrap, "<qjs-bootstrap>");
        if ("error" in bootstrapResult) {
            const message = printable(context, bootstrapResult.error);
            bootstrapResult.error.dispose();
            return {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
        }
        bootstrapResult.value.dispose();

        const result = await context.evalCodeAsync(
            `(async () => {\n${options.code}\nif (globalThis.__utilityPromise) await globalThis.__utilityPromise;\n})()`,
            options.fileName,
            {type: "global"}
        );
        if ("error" in result) {
            const message = printable(context, result.error);
            result.error.dispose();
            if (options.signal?.aborted || Date.now() >= deadline) {
                return {
                    stdout,
                    stderr: `${stderr}qjs: execution timed out or was aborted\n`,
                    exitCode: 124
                };
            }
            if (message.includes(PROCESS_EXIT_PREFIX)) return {stdout, stderr, exitCode};
            return {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
        }
        const execution = context.resolvePromise(result.value);
        result.value.dispose();
        let settled = false;
        execution.finally(() => {
            settled = true;
        });
        while (!settled) {
            if (options.signal?.aborted || Date.now() >= deadline) {
                return {
                    stdout,
                    stderr: `${stderr}qjs: execution timed out or was aborted\n`,
                    exitCode: 124
                };
            }
            const pendingJobs = runtime.executePendingJobs();
            if (pendingJobs.error) {
                const message = printable(context, pendingJobs.error);
                pendingJobs.error.dispose();
                if (options.signal?.aborted || Date.now() >= deadline) {
                    return {
                        stdout,
                        stderr: `${stderr}qjs: execution timed out or was aborted\n`,
                        exitCode: 124
                    };
                }
                return {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const completion = await execution;
        if ("error" in completion) {
            const message = printable(context, completion.error);
            completion.error.dispose();
            if (options.signal?.aborted || Date.now() >= deadline) {
                return {
                    stdout,
                    stderr: `${stderr}qjs: execution timed out or was aborted\n`,
                    exitCode: 124
                };
            }
            if (message.includes(PROCESS_EXIT_PREFIX)) return {stdout, stderr, exitCode};
            return {stdout, stderr: `${stderr}qjs: ${message}\n`, exitCode: 1};
        }
        completion.value.dispose();

        return {stdout, stderr, exitCode};
    } finally {
        context.dispose();
    }
}

function createBootstrap(options: ExecutionOptions): string {
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
globalThis.fetch = async (url, init) => new Response(JSON.parse(__hostFetch(String(url), init || {})));
globalThis.console = Object.freeze({log: (...args) => __stdout(...args), error: (...args) => __stderr(...args), warn: (...args) => __stderr(...args)});
globalThis.process = Object.freeze({argv: ${JSON.stringify(["qjs", options.fileName, ...options.args])}, env: Object.freeze(${JSON.stringify(options.env)}), cwd: () => ${JSON.stringify(options.cwd)}, exit: __exit});
`;
}
