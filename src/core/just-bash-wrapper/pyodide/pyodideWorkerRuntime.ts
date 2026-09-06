import {releaseProxy} from "comlink";
import type {PyodideInterface} from "pyodide";
import type {
    PythonExecutionResult,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "./workerProtocol";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const PACKAGE_BASE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";

type ReleasableWorkerFetch = PythonWorkerFetch & {[releaseProxy]?: () => void};

let pyodide: PyodideInterface | undefined;
let micropipLoaded = false;
let originalFetch: typeof globalThis.fetch | undefined;
let allowedLocalAssetUrls: ReadonlySet<string> = new Set();
const pythonGlobals: {fetch?: typeof globalThis.fetch} = {};
let stdout = "";
let stderr = "";
let stdoutDecoder = new TextDecoder();
let stderrDecoder = new TextDecoder();

export async function initializePyodideWorker(runtimeBaseUrl: string): Promise<void> {
    if (pyodide) return;

    originalFetch = globalThis.fetch.bind(globalThis);
    const normalizedBaseUrl = new URL(runtimeBaseUrl);
    normalizedBaseUrl.pathname = normalizedBaseUrl.pathname.replace(/\/?$/, "/");
    allowedLocalAssetUrls = new Set([
        new URL("pyodide.asm.wasm", normalizedBaseUrl).href,
        new URL("python_stdlib.zip", normalizedBaseUrl).href
    ]);

    const {loadPyodide} = (await import(
        /* @vite-ignore */ new URL("pyodide.mjs", normalizedBaseUrl).href
    )) as typeof import("pyodide");
    pyodide = await loadPyodide({
        indexURL: normalizedBaseUrl.href,
        packageBaseUrl: PACKAGE_BASE_URL,
        stdout: (value) => appendStdout(`${value}\n`),
        stderr: (value) => appendStderr(`${value}\n`),
        jsglobals: pythonGlobals
    });
}

export async function executePythonInWorker(
    execution: PythonWorkerExecution,
    fetch: PythonWorkerFetch
): Promise<PythonExecutionResult> {
    if (!pyodide || !originalFetch) throw new Error("Pyodide is not initialized");

    stdout = "";
    stderr = "";
    stdoutDecoder = new TextDecoder();
    stderrDecoder = new TextDecoder();
    const secureFetch = createWorkerFetch(fetch);
    globalThis.fetch = secureFetch;
    pythonGlobals.fetch = protectCallable(secureFetch);
    pyodide.setStdout({
        write: (buffer) => {
            appendStdout(stdoutDecoder.decode(buffer, {stream: true}));
            return buffer.byteLength;
        }
    });
    pyodide.setStderr({
        write: (buffer) => {
            appendStderr(stderrDecoder.decode(buffer, {stream: true}));
            return buffer.byteLength;
        }
    });
    let stdinOffset = 0;
    pyodide.setStdin({
        stdin: () => {
            if (stdinOffset >= execution.stdin.length) return null;
            const newline = execution.stdin.indexOf("\n", stdinOffset);
            const end = newline === -1 ? execution.stdin.length : newline + 1;
            const line = execution.stdin.slice(stdinOffset, end);
            stdinOffset = end;
            return line;
        },
        autoEOF: true
    });

    try {
        if (!micropipLoaded) {
            await pyodide.loadPackage("micropip");
            micropipLoaded = true;
        }
        pyodide.runPython(createBootstrap(execution));
        const exitCode = await pyodide.runPythonAsync(createExecutionWrapper(execution), {
            filename: "<python-command>"
        });
        appendStdout(stdoutDecoder.decode());
        appendStderr(stderrDecoder.decode());
        return {stdout, stderr, exitCode: Number(exitCode)};
    } catch (error) {
        appendStdout(stdoutDecoder.decode());
        appendStderr(stderrDecoder.decode());
        const message = error instanceof Error ? error.message : String(error);
        return {stdout, stderr: appendError(stderr, message), exitCode: 1};
    } finally {
        globalThis.fetch = originalFetch;
        delete pythonGlobals.fetch;
        try {
            (fetch as ReleasableWorkerFetch)[releaseProxy]?.();
        } catch {
            // Worker termination remains the authoritative callback cleanup.
        }
    }
}

function createWorkerFetch(hostFetch: PythonWorkerFetch): typeof globalThis.fetch {
    return async (input, init) => {
        const request = new Request(input, init);
        if (allowedLocalAssetUrls.has(request.url)) {
            return originalFetch!(request);
        }

        const requestBody = request.body === null ? undefined : await request.text();
        const result = await hostFetch(request.url, {
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: requestBody
        });
        const response = new Response(result.body, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers
        });
        Object.defineProperty(response, "url", {value: result.url});
        return response;
    };
}

function protectCallable<T extends (...args: never[]) => unknown>(callback: T): T {
    return new Proxy(callback, {
        get: (_target, property) => {
            if (property === "name") return "securedCapability";
            throw new Error(`Access to fetch.${String(property)} is denied`);
        },
        apply: (target, thisArg, args) => Reflect.apply(target, thisArg, args)
    });
}

function appendStdout(value: string): void {
    stdout = appendOutput(stdout, value);
}

function appendStderr(value: string): void {
    stderr = appendOutput(stderr, value);
}

function appendOutput(current: string, value: string): string {
    const next = current + value;
    if (new TextEncoder().encode(next).byteLength > MAX_OUTPUT_BYTES) {
        throw new Error("output exceeded 1 MiB");
    }
    return next;
}

function appendError(current: string, message: string): string {
    const normalized = message.endsWith("\n") ? message : `${message}\n`;
    return current.includes(message) ? current : `${current}${normalized}`;
}

function createBootstrap(execution: PythonWorkerExecution): string {
    return `
import os
import sys

os.makedirs(${JSON.stringify(execution.cwd)}, exist_ok=True)
os.chdir(${JSON.stringify(execution.cwd)})
os.environ.update(${JSON.stringify(execution.env)})
sys.argv = ${JSON.stringify([execution.fileName, ...execution.args])}
`;
}

function createExecutionWrapper(execution: PythonWorkerExecution): string {
    return `
import sys
from pyodide.code import eval_code_async

try:
    await eval_code_async(
        ${JSON.stringify(execution.code)},
        globals(),
        filename=${JSON.stringify(execution.fileName)},
    )
except SystemExit as error:
    if error.code is None:
        0
    elif isinstance(error.code, int):
        error.code
    else:
        print(error.code, file=sys.stderr)
        1
else:
    0
`;
}
