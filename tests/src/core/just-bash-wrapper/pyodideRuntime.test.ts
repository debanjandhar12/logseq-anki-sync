import type {SecureFetch} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {executePython} from "../../../../src/core/just-bash-wrapper/pyodide/pyodideRuntime";
import type {
    PythonExecutionResult,
    PythonWorkerExecution,
    PythonWorkerFetch
} from "../../../../src/core/just-bash-wrapper/pyodide/workerProtocol";

const fetch: SecureFetch = async (url) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    body: new Uint8Array([1, 2, 3]),
    url
});

class FakeWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    terminate = vi.fn();
}

class FakeWorkerClient {
    ready = vi.fn<(runtimeBaseUrl: string) => Promise<void>>(() => Promise.resolve());
    execute = vi.fn<
        (
            execution: PythonWorkerExecution,
            fetch: PythonWorkerFetch
        ) => Promise<PythonExecutionResult>
    >(() => Promise.resolve({stdout: "2\n", stderr: "", exitCode: 0}));
    release = vi.fn();
}

function executionOptions(worker: FakeWorker, client: FakeWorkerClient) {
    return {
        code: "print(2)",
        fileName: "test.py",
        args: [],
        stdin: "",
        cwd: "/home/user",
        env: {},
        fetch,
        runtimeBaseUrl: "https://plugin.test/pyodide/",
        workerFactory: () => worker as unknown as Worker,
        workerClientFactory: () => client
    };
}

describe("Pyodide worker orchestration", () => {
    test("waits for readiness and terminates after execution", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        let markReady: (() => void) | undefined;
        client.ready.mockImplementation(
            () =>
                new Promise((resolve) => {
                    markReady = resolve;
                })
        );

        const execution = executePython(executionOptions(worker, client));
        await Promise.resolve();
        expect(client.execute).not.toHaveBeenCalled();

        markReady?.();
        await expect(execution).resolves.toEqual({stdout: "2\n", stderr: "", exitCode: 0});
        expect(client.ready).toHaveBeenCalledWith("https://plugin.test/pyodide/");
        expect(client.execute).toHaveBeenCalledWith(
            {
                code: "print(2)",
                fileName: "test.py",
                args: [],
                stdin: "",
                cwd: "/home/user",
                env: {}
            },
            expect.any(Function)
        );
        expect(client.release).toHaveBeenCalledOnce();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("preserves binary host fetch responses", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        const hostFetch = vi.fn(fetch);
        client.execute.mockImplementation(async (_execution, workerFetch) => {
            const response = await workerFetch("https://example.com/package.whl", {method: "GET"});
            expect(response.body).toEqual(new Uint8Array([1, 2, 3]));
            return {stdout: "", stderr: "", exitCode: 0};
        });

        await executePython({...executionOptions(worker, client), fetch: hostFetch});

        expect(hostFetch).toHaveBeenCalledWith(
            "https://example.com/package.whl",
            expect.objectContaining({method: "GET", signal: expect.any(AbortSignal)})
        );
    });

    test("hard-terminates startup and execution timeouts", async () => {
        const startupWorker = new FakeWorker();
        const startupClient = new FakeWorkerClient();
        startupClient.ready.mockImplementation(() => new Promise(() => undefined));

        await expect(
            executePython({
                ...executionOptions(startupWorker, startupClient),
                startupTimeoutMs: 20
            })
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "python: worker startup timed out\n"})
        );
        expect(startupWorker.terminate).toHaveBeenCalledOnce();

        const executionWorker = new FakeWorker();
        const executionClient = new FakeWorkerClient();
        executionClient.execute.mockImplementation(() => new Promise(() => undefined));
        await expect(
            executePython({
                ...executionOptions(executionWorker, executionClient),
                executionTimeoutMs: 20
            })
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "python: execution timed out\n"})
        );
        expect(executionWorker.terminate).toHaveBeenCalledOnce();
    });

    test("immediately terminates an already-aborted execution", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        const controller = new AbortController();
        controller.abort();

        await expect(
            executePython({...executionOptions(worker, client), signal: controller.signal})
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "python: execution aborted\n"})
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("terminates after worker and release failures", async () => {
        const failedWorker = new FakeWorker();
        const failedClient = new FakeWorkerClient();
        failedClient.ready.mockImplementation(() => {
            queueMicrotask(() => failedWorker.onerror?.({message: "WASM failed"} as ErrorEvent));
            return new Promise(() => undefined);
        });

        await expect(executePython(executionOptions(failedWorker, failedClient))).resolves.toEqual(
            expect.objectContaining({exitCode: 1, stderr: "python: WASM failed\n"})
        );
        expect(failedWorker.terminate).toHaveBeenCalledOnce();

        const releaseWorker = new FakeWorker();
        const releaseClient = new FakeWorkerClient();
        releaseClient.release.mockImplementation(() => {
            throw new Error("release failed");
        });
        await expect(
            executePython(executionOptions(releaseWorker, releaseClient))
        ).resolves.toEqual({
            stdout: "2\n",
            stderr: "",
            exitCode: 0
        });
        expect(releaseWorker.terminate).toHaveBeenCalledOnce();
    });
});
