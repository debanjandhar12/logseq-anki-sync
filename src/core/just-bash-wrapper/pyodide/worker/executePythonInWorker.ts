import {releaseProxy} from "comlink";
import type {
    PythonExecutionResult,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "../workerProtocol";
import {collectSandboxChanges} from "./collectSandboxChanges";
import {createPythonExecution} from "./createPythonExecution";
import {createPythonIO} from "./createPythonIO";
import {createWorkerFetch} from "./createWorkerFetch";
import type {PyodideWorkerRuntime} from "./initializePyodideWorker";
import {loadSandboxSnapshot} from "./loadSandboxSnapshot";

export async function executePythonInWorker(
    runtime: PyodideWorkerRuntime,
    execution: PythonWorkerExecution,
    fetch: PythonWorkerFetch
): Promise<PythonExecutionResult> {
    const {pyodide, originalFetch, allowedLocalAssetUrls, capabilities} = runtime;
    const io = createPythonIO(execution.stdin);
    let snapshotLoaded = false;
    let result: PythonExecutionResult;
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
            (fetch as PythonWorkerFetch & {[releaseProxy]?: () => void})[releaseProxy]?.();
        } catch {
            // Worker termination remains the authoritative callback cleanup.
        }
    }
}
