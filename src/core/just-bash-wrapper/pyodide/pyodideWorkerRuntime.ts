import {configure, fs, InMemory} from "@zenfs/core";
import {releaseProxy} from "comlink";
import type {PyodideInterface} from "pyodide";
import {ZenFsEmscriptenBridge} from "../zenfs/EmscriptenBridge";
import {
    diffSharedFiles,
    prepareWorkerSharedFiles,
    readSharedFilesSync
} from "../zenfs/sharedFiles";
import type {
    PythonExecutionResult,
    PythonSharedFile,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "./workerProtocol";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const PACKAGE_BASE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
const PYODIDE_MOUNT_POINT = "/home/user";

type ReleasableWorkerFetch = PythonWorkerFetch & {[releaseProxy]?: () => void};

let pyodide: PyodideInterface | undefined;
let micropipLoaded = false;
let originalFetch: typeof globalThis.fetch | undefined;
let allowedLocalAssetUrls: ReadonlySet<string> = new Set();
const pythonGlobals: {
    fetch?: typeof globalThis.fetch;
    AbortController: typeof AbortController;
    AbortSignal: typeof AbortSignal;
    Object: ObjectConstructor;
    Request: typeof Request;
} = {
    AbortController: protectConstructor(globalThis.AbortController),
    AbortSignal: protectConstructor(globalThis.AbortSignal),
    Object: protectConstructor(globalThis.Object, {
        fromEntries: protectCallable(globalThis.Object.fromEntries)
    }),
    Request: protectConstructor(globalThis.Request)
};
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
        await configure({mounts: {"/": InMemory}});
        await prepareWorkerSharedFiles(execution.files ?? []);
        await fs.promises.mkdir(PYODIDE_MOUNT_POINT, {recursive: true});
        const sharedMount = mountSharedFileSystem(pyodide);
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
        const normalizedExitCode = Number(exitCode);
        if (!Number.isInteger(normalizedExitCode)) {
            throw new Error("Python runtime returned an invalid exit code");
        }
        return {
            stdout,
            stderr,
            exitCode: normalizedExitCode,
            changedFiles: diffSharedFiles(
                execution.files ?? [],
                readSharedFilesSync(PYODIDE_MOUNT_POINT)
            )
        };
    } catch (error) {
        appendStdout(stdoutDecoder.decode());
        appendStderr(stderrDecoder.decode());
        const message = error instanceof Error ? error.message : String(error);
        return {stdout, stderr: appendError(stderr, message), exitCode: 1};
    } finally {
        try {
            pyodide.FS.unmount(PYODIDE_MOUNT_POINT);
        } catch {
            // the worker is discarded after execution anyway
        }
        globalThis.fetch = originalFetch;
        delete pythonGlobals.fetch;
        try {
            (fetch as ReleasableWorkerFetch)[releaseProxy]?.();
        } catch {
            // Worker termination remains the authoritative callback cleanup.
        }
    }
}

function mountSharedFileSystem(pyodide: PyodideInterface): void {
    try {
        pyodide.FS.mkdirTree(PYODIDE_MOUNT_POINT);
    } catch {
        // EEXIST is fine — the mount attaches over the existing directory
    }
    const bridge = new ZenFsEmscriptenBridge(
        fs,
        pyodide.FS as unknown as ConstructorParameters<typeof ZenFsEmscriptenBridge>[1]
    );
    pyodide.FS.mount(bridge, {root: PYODIDE_MOUNT_POINT}, PYODIDE_MOUNT_POINT);
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

function protectConstructor<T extends abstract new (...args: never[]) => unknown>(
    constructorFn: T,
    allowedProperties: Record<PropertyKey, unknown> = {}
): T {
    return new Proxy(constructorFn, {
        get: (_target, property) => {
            if (property === "name") return "securedCapability";
            if (Object.hasOwn(allowedProperties, property)) return allowedProperties[property];
            throw new Error(`Access to ${constructorFn.name}.${String(property)} is denied`);
        },
        construct: (target, args) => Reflect.construct(target, args)
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

exit_code = 0
try:
    await eval_code_async(
        ${JSON.stringify(execution.code)},
        globals(),
        filename=${JSON.stringify(execution.fileName)},
    )
except SystemExit as error:
    if error.code is None:
        exit_code = 0
    elif isinstance(error.code, int):
        exit_code = error.code
    else:
        print(error.code, file=sys.stderr)
        exit_code = 1

exit_code
`;
}
