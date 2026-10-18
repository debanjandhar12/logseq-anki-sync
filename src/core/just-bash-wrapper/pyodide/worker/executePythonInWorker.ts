import {releaseProxy} from "comlink";
import {installLogseqLib} from "../logseq-lib/installLogseqLib";
import type {LogseqLibBridge} from "../logseq-lib/types";
import type {PythonExecutionResult, PythonWorkerExecution, PythonWorkerFetch} from "../types";
import {collectSandboxChanges} from "./collectSandboxChanges";
import {createPythonExecution} from "./createPythonExecution";
import {createPythonIO} from "./createPythonIO";
import {createWorkerFetch} from "./createWorkerFetch";
import type {PyodideWorkerRuntime} from "./initializePyodideWorker";
import {loadSandboxSnapshot} from "./loadSandboxSnapshot";

export async function executePythonInWorker(
    runtime: PyodideWorkerRuntime,
    execution: PythonWorkerExecution,
    fetch: PythonWorkerFetch,
    logseqLib?: LogseqLibBridge
): Promise<PythonExecutionResult> {
    const {pyodide, originalFetch, allowedLocalAssetUrls, capabilities} = runtime;
    const io = createPythonIO(execution.stdin);
    let snapshotLoaded = false;
    let result: PythonExecutionResult;
    let uninstallLogseqLib: (() => void) | undefined;
    try {
        const secureFetch = createWorkerFetch(fetch, originalFetch, allowedLocalAssetUrls);
        globalThis.fetch = secureFetch;
        capabilities.installFetch(secureFetch);
        pyodide.setStdout(io.stdout);
        pyodide.setStderr(io.stderr);
        pyodide.setStdin(io.stdin);
        loadSandboxSnapshot(pyodide.FS, execution.snapshot);
        snapshotLoaded = true;
        await pyodide.loadPackage("micropip");
        const {bootstrap, source} = createPythonExecution(execution);
        pyodide.runPython(bootstrap);
        if (logseqLib) {
            // Comlink proxied object properties are asynchronous.
            uninstallLogseqLib = installLogseqLib(pyodide, {
                methods: await logseqLib.methods,
                call: (method, args) => logseqLib.call(method, args)
            });
        }
        const exitCode = Number(
            await pyodide.runPythonAsync(source, {filename: "<python-command>"})
        );
        if (!Number.isInteger(exitCode))
            throw new Error("Python runtime returned an invalid exit code");
        result = io.result(exitCode);
    } catch (error) {
        result = io.result(1, error);
    }

    if (snapshotLoaded) {
        try {
            result.changes = collectSandboxChanges(pyodide.FS, execution.snapshot);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result = {
                stdout: result.stdout,
                stderr: `${result.stderr}python: cannot collect sandbox filesystem changes: ${message}\n`,
                exitCode: 1
            };
        }
    }
    try {
        return result;
    } finally {
        globalThis.fetch = originalFetch;
        delete capabilities.globals.fetch;
        try {
            uninstallLogseqLib?.();
        } finally {
            try {
                (fetch as PythonWorkerFetch & {[releaseProxy]?: () => void})[releaseProxy]?.();
                (logseqLib as (LogseqLibBridge & {[releaseProxy]?: () => void}) | undefined)?.[
                    releaseProxy
                ]?.();
            } catch {
                // Worker termination remains the authoritative callback cleanup.
            }
        }
    }
}
