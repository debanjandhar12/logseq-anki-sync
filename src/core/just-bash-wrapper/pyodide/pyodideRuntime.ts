import {proxy, releaseProxy, wrap} from "comlink";
import type {SecureFetch} from "just-bash";
import type {
    PythonExecutionResult,
    PythonWorkerApi,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "./workerProtocol";
import PyodideWorker from "./pyodideWorker?worker";

const STARTUP_TIMEOUT_MS = 30_000;
const EXECUTION_TIMEOUT_MS = 120_000;

interface PythonWorkerClient {
    ready(runtimeBaseUrl: string): Promise<void>;
    execute(
        execution: PythonWorkerExecution,
        fetch: PythonWorkerFetch
    ): Promise<PythonExecutionResult>;
    release(): void;
}

interface ExecutionOptions extends PythonWorkerExecution {
    fetch: SecureFetch;
    signal?: AbortSignal;
    startupTimeoutMs?: number;
    executionTimeoutMs?: number;
    runtimeBaseUrl?: string;
    workerFactory?: () => Worker;
    workerClientFactory?: (worker: Worker) => PythonWorkerClient;
}

class PythonDeadlineError extends Error {}

export async function executePython(options: ExecutionOptions): Promise<PythonExecutionResult> {
    let worker: Worker;
    try {
        worker = options.workerFactory?.() ?? new PyodideWorker();
    } catch (error) {
        return failure(error);
    }

    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, {once: true});
    if (options.signal?.aborted) abort();

    const workerError = new Promise<never>((_, reject) => {
        worker.onerror = ({message}) => reject(new Error(message || "worker failed to start"));
        worker.onmessageerror = () => reject(new Error("worker message could not be decoded"));
    });
    let client: PythonWorkerClient;
    try {
        client = options.workerClientFactory?.(worker) ?? createComlinkClient(worker);
    } catch (error) {
        options.signal?.removeEventListener("abort", abort);
        controller.abort();
        worker.terminate();
        return failure(error);
    }

    try {
        await withDeadline(
            client.ready(options.runtimeBaseUrl ?? new URL("pyodide/", document.baseURI).href),
            options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS,
            "worker startup timed out",
            controller.signal,
            workerError
        );
        return await withDeadline(
            client.execute(
                createExecution(options),
                proxy(createWorkerFetch(options.fetch, controller.signal))
            ),
            options.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS,
            "execution timed out",
            controller.signal,
            workerError
        );
    } catch (error) {
        if (error instanceof PythonDeadlineError || controller.signal.aborted) {
            return {
                stdout: "",
                stderr: `python: ${error instanceof Error ? error.message : "execution aborted"}\n`,
                exitCode: 124
            };
        }
        return failure(error);
    } finally {
        options.signal?.removeEventListener("abort", abort);
        controller.abort();
        try {
            client.release();
        } catch {
            // Worker termination remains the authoritative cleanup operation.
        } finally {
            worker.terminate();
        }
    }
}

function createExecution(options: ExecutionOptions): PythonWorkerExecution {
    return {
        code: options.code,
        fileName: options.fileName,
        args: options.args,
        stdin: options.stdin,
        cwd: options.cwd,
        env: options.env,
        files: options.files
    };
}

function createComlinkClient(worker: Worker): PythonWorkerClient {
    const remote = wrap<PythonWorkerApi>(worker);
    return {
        ready: (runtimeBaseUrl) => remote.ready(runtimeBaseUrl),
        execute: (execution, fetch) => remote.execute(execution, fetch),
        release: () => remote[releaseProxy]()
    };
}

function createWorkerFetch(fetch: SecureFetch, signal: AbortSignal): PythonWorkerFetch {
    return (url, requestOptions) => fetch(url, {...requestOptions, signal});
}

function withDeadline<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    signal: AbortSignal,
    workerError: Promise<never>
): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal.removeEventListener("abort", handleAbort);
            callback();
        };
        const handleAbort = () =>
            finish(() => reject(new PythonDeadlineError("execution aborted")));
        const timeout = setTimeout(
            () => finish(() => reject(new PythonDeadlineError(timeoutMessage))),
            timeoutMs
        );
        signal.addEventListener("abort", handleAbort, {once: true});
        if (signal.aborted) handleAbort();

        void Promise.race([operation, workerError]).then(
            (value) => finish(() => resolve(value)),
            (error) => finish(() => reject(error))
        );
    });
}

function failure(error: unknown): PythonExecutionResult {
    return {
        stdout: "",
        stderr: `python: ${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1
    };
}
