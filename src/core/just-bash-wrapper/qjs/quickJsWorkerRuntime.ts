import {newAsyncContext, type QuickJSAsyncContext, type QuickJSHandle} from "quickjs-emscripten";
import type {QuickJsExecutionResult, QuickJsWorkerExecution} from "./workerProtocol";

const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const PROCESS_EXIT_PREFIX = "__QJS_PROCESS_EXIT__";

type WorkerFetch = (url: string, options: Record<string, unknown>) => Promise<string>;

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

export async function executeQuickJsInWorker(
    options: QuickJsWorkerExecution,
    fetch: WorkerFetch
): Promise<QuickJsExecutionResult> {
    const context = await newAsyncContext({});
    const runtime = context.runtime;
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(STACK_LIMIT_BYTES);
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

        const hostFetch = context.newAsyncifiedFunction("__hostFetch", async (url, init) =>
            context.newString(
                await fetch(
                    context.getString(url),
                    (init ? context.dump(init) : {}) as Record<string, unknown>
                )
            )
        );
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
            `(async () => {\n${options.code}\nif (globalThis.__utilityPromise) await globalThis.__utilityPromise;\n})()`,
            options.fileName,
            {type: "global"}
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
        context.dispose();
    }
}

function guestError(
    context: QuickJSAsyncContext,
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
globalThis.fetch = async (url, init) => new Response(JSON.parse(__hostFetch(String(url), init || {})));
globalThis.console = Object.freeze({log: (...args) => __stdout(...args), error: (...args) => __stderr(...args), warn: (...args) => __stderr(...args)});
globalThis.process = Object.freeze({argv: ${JSON.stringify(["qjs", options.fileName, ...options.args])}, env: Object.freeze(${JSON.stringify(options.env)}), cwd: () => ${JSON.stringify(options.cwd)}, exit: __exit});
`;
}
