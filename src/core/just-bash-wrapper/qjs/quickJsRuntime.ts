import {proxy, releaseProxy, wrap} from "comlink";
import type {SecureFetch} from "just-bash";
import QuickJsWorker from "./quickJsWorker?worker";
import type {
    QuickJsExecutionResult,
    QuickJsWorkerApi,
    QuickJsWorkerExecution,
    QuickJsWorkerFetch
} from "./workerProtocol";

const STARTUP_TIMEOUT_MS = 5_000;
const EXECUTION_TIMEOUT_MS = 30_000;

interface QuickJsWorkerClient {
    ready(): Promise<void>;
    execute(
        execution: QuickJsWorkerExecution,
        fetch: QuickJsWorkerFetch
    ): Promise<QuickJsExecutionResult>;
    release(): void;
}

interface ExecutionOptions extends QuickJsWorkerExecution {
    fetch: SecureFetch;
    signal?: AbortSignal;
    startupTimeoutMs?: number;
    executionTimeoutMs?: number;
    workerFactory?: () => Worker;
    workerClientFactory?: (worker: Worker) => QuickJsWorkerClient;
}

class QuickJsDeadlineError extends Error {}

export async function executeQuickJs(options: ExecutionOptions): Promise<QuickJsExecutionResult> {
    let worker: Worker;
    try {
        worker = options.workerFactory?.() ?? new QuickJsWorker();
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
    let client: QuickJsWorkerClient;
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
            client.ready(),
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
        if (error instanceof QuickJsDeadlineError || controller.signal.aborted) {
            return {
                stdout: "",
                stderr: `qjs: ${error instanceof Error ? error.message : "execution aborted"}\n`,
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

function createComlinkClient(worker: Worker): QuickJsWorkerClient {
    const remote = wrap<QuickJsWorkerApi>(worker);
    return {
        ready: () => remote.ready(),
        execute: (execution, fetch) => remote.execute(execution, fetch),
        release: () => remote[releaseProxy]()
    };
}

function createWorkerFetch(fetch: SecureFetch, signal: AbortSignal): QuickJsWorkerFetch {
    return async (url, requestOptions) => {
        const result = await fetch(url, {...requestOptions, signal});
        return JSON.stringify({...result, body: new TextDecoder().decode(result.body)});
    };
}

function createExecution(options: ExecutionOptions): QuickJsWorkerExecution {
    return {
        code: options.code,
        fileName: options.fileName,
        args: options.args,
        cwd: options.cwd,
        env: options.env
    };
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
            finish(() => reject(new QuickJsDeadlineError("execution aborted")));
        const timeout = setTimeout(
            () => finish(() => reject(new QuickJsDeadlineError(timeoutMessage))),
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

function failure(error: unknown): QuickJsExecutionResult {
    return {
        stdout: "",
        stderr: `qjs: ${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1
    };
}
