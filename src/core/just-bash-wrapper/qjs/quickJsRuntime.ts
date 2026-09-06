import type {SecureFetch} from "just-bash";
import QuickJsWorker from "./quickJsWorker?worker";
import type {
    QuickJsExecutionResult,
    QuickJsWorkerExecution,
    QuickJsWorkerRequest,
    QuickJsWorkerResponse
} from "./workerProtocol";

const EXECUTION_TIMEOUT_MS = 30_000;

interface ExecutionOptions extends QuickJsWorkerExecution {
    fetch: SecureFetch;
    signal?: AbortSignal;
    executionTimeoutMs?: number;
    workerFactory?: () => Worker;
}

export function executeQuickJs(options: ExecutionOptions): Promise<QuickJsExecutionResult> {
    let worker: Worker;
    try {
        worker = options.workerFactory?.() ?? new QuickJsWorker();
    } catch (error) {
        return Promise.resolve({
            stdout: "",
            stderr: `qjs: ${error instanceof Error ? error.message : String(error)}\n`,
            exitCode: 1
        });
    }
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, {once: true});
    if (options.signal?.aborted) abort();

    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: QuickJsExecutionResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", abort);
            controller.abort();
            worker.terminate();
            resolve(result);
        };
        const timeout = setTimeout(
            () =>
                finish({
                    stdout: "",
                    stderr: "qjs: execution timed out or was aborted\n",
                    exitCode: 124
                }),
            options.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS
        );

        const finishAborted = () =>
            finish({
                stdout: "",
                stderr: "qjs: execution timed out or was aborted\n",
                exitCode: 124
            });
        controller.signal.addEventListener("abort", finishAborted, {once: true});
        if (controller.signal.aborted) finishAborted();
        worker.onerror = ({message}) =>
            finish({stdout: "", stderr: `qjs: ${message}\n`, exitCode: 1});
        worker.onmessage = ({data}: MessageEvent<QuickJsWorkerResponse>) => {
            if (data.type === "result") finish(data.result);
            else if (data.type === "error") {
                finish({stdout: "", stderr: `qjs: ${data.message}\n`, exitCode: 1});
            } else if (data.type === "fetch") {
                void handleFetch(worker, data, options.fetch, controller.signal);
            }
        };

        const request: QuickJsWorkerRequest = {
            type: "execute",
            execution: {
                code: options.code,
                fileName: options.fileName,
                args: options.args,
                cwd: options.cwd,
                env: options.env
            }
        };
        try {
            worker.postMessage(request);
        } catch (error) {
            finish({
                stdout: "",
                stderr: `qjs: ${error instanceof Error ? error.message : String(error)}\n`,
                exitCode: 1
            });
        }
    });
}

async function handleFetch(
    worker: Worker,
    request: Extract<QuickJsWorkerResponse, {type: "fetch"}>,
    fetch: SecureFetch,
    signal: AbortSignal
): Promise<void> {
    try {
        const result = await fetch(request.url, {...request.options, signal});
        const response: QuickJsWorkerRequest = {type: "fetch-result", id: request.id, result};
        worker.postMessage(response);
    } catch (error) {
        if (signal.aborted) return;
        const response: QuickJsWorkerRequest = {
            type: "fetch-error",
            id: request.id,
            message: error instanceof Error ? error.message : String(error)
        };
        worker.postMessage(response);
    }
}
