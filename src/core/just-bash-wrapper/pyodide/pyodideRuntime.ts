import {proxy, releaseProxy, wrap} from "comlink";
import type {SecureFetch} from "just-bash";
import pTimeout, {TimeoutError} from "p-timeout";
import PyodideWorker from "./worker/pyodideWorker?worker";
import type {
    PythonExecutionResult,
    PythonWorkerApi,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "./workerProtocol";

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
    let client: PythonWorkerClient | undefined;
    try {
        const startupTimeout = normalizeTimeout(options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS);
        const executionTimeout = normalizeTimeout(
            options.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS
        );
        controller.signal.throwIfAborted();
        client = options.workerClientFactory?.(worker) ?? createComlinkClient(worker);
        await pTimeout(
            Promise.race([
                client.ready(options.runtimeBaseUrl ?? new URL("pyodide/", document.baseURI).href),
                workerError
            ]),
            {
                milliseconds: startupTimeout,
                message: "worker startup timed out",
                signal: controller.signal
            }
        );
        controller.signal.throwIfAborted();
        return await pTimeout(
            Promise.race([
                client.execute(
                    createExecution(options),
                    proxy(createWorkerFetch(options.fetch, controller.signal))
                ),
                workerError
            ]),
            {
                milliseconds: executionTimeout,
                message: "execution timed out",
                signal: controller.signal
            }
        );
    } catch (error) {
        if (controller.signal.aborted || error instanceof TimeoutError) {
            return {
                stdout: "",
                stderr: `python: ${controller.signal.aborted ? "execution aborted" : (error as TimeoutError).message}\n`,
                exitCode: 124
            };
        }
        return failure(error);
    } finally {
        options.signal?.removeEventListener("abort", abort);
        worker.onerror = null;
        worker.onmessageerror = null;
        controller.abort();
        try {
            client?.release();
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
        env: options.env
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

function normalizeTimeout(milliseconds: number): number {
    if (Number.isNaN(milliseconds) || milliseconds === Number.NEGATIVE_INFINITY) {
        throw new Error("Python timeout must be a finite number or positive infinity");
    }
    return Math.max(1, milliseconds);
}

function failure(error: unknown): PythonExecutionResult {
    return {
        stdout: "",
        stderr: `python: ${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1
    };
}
