import {releaseProxy} from "comlink";
import type {
    PythonExecutionResult,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "../workerProtocol";
import {createPythonExecution} from "./createPythonExecution";
import {createPythonIO} from "./createPythonIO";
import {createWorkerFetch} from "./createWorkerFetch";
import type {PyodideWorkerRuntime} from "./initializePyodideWorker";

export async function executePythonInWorker(
    runtime: PyodideWorkerRuntime,
    execution: PythonWorkerExecution,
    fetch: PythonWorkerFetch
): Promise<PythonExecutionResult> {
    const {pyodide, originalFetch, allowedLocalAssetUrls, capabilities} = runtime;
    const io = createPythonIO(execution.stdin);
    try {
        const secureFetch = createWorkerFetch(fetch, originalFetch, allowedLocalAssetUrls);
        globalThis.fetch = secureFetch;
        capabilities.installFetch(secureFetch);
        pyodide.setStdout(io.stdout);
        pyodide.setStderr(io.stderr);
        pyodide.setStdin(io.stdin);
        await pyodide.loadPackage("micropip");
        const {bootstrap, source} = createPythonExecution(execution);
        pyodide.runPython(bootstrap);
        const exitCode = Number(
            await pyodide.runPythonAsync(source, {filename: "<python-command>"})
        );
        if (!Number.isInteger(exitCode))
            throw new Error("Python runtime returned an invalid exit code");
        return io.result(exitCode);
    } catch (error) {
        return io.result(1, error);
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
