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

    test.each([
        "startup",
        "execution"
    ])("cancels during %s and preserves stable diagnostics", async (phase) => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        const controller = new AbortController();
        const pending = vi.fn(() => {
            queueMicrotask(() => controller.abort("custom reason"));
            return new Promise<never>(() => undefined);
        });
        if (phase === "startup") client.ready.mockImplementation(pending);
        else client.execute.mockImplementation(pending);
        expect(
            await executePython({...executionOptions(worker, client), signal: controller.signal})
        ).toEqual({stdout: "", stderr: "python: execution aborted\n", exitCode: 124});
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(client.release).toHaveBeenCalledOnce();
        expect(worker.onerror).toBeNull();
        expect(worker.onmessageerror).toBeNull();
    });

    test("does not dispatch readiness for pre-aborted input", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        await executePython({
            ...executionOptions(worker, client),
            signal: AbortSignal.abort("reason")
        });
        expect(client.ready).not.toHaveBeenCalled();
        expect(client.execute).not.toHaveBeenCalled();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("timeout aborts pending host fetch and consumes a late operation rejection", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        let fetchSignal: AbortSignal | undefined;
        let rejectOperation: (error: Error) => void;
        const hostFetch: SecureFetch = async (_url, options) => {
            fetchSignal = options?.signal;
            return new Promise(() => undefined);
        };
        client.execute.mockImplementation((_execution, workerFetch) => {
            void workerFetch("https://example.com", {});
            return new Promise((_, reject) => {
                rejectOperation = reject;
            });
        });
        const result = await executePython({
            ...executionOptions(worker, client),
            fetch: hostFetch,
            executionTimeoutMs: 10
        });
        expect(result.exitCode).toBe(124);
        expect(fetchSignal?.aborted).toBe(true);
        rejectOperation(new Error("late failure"));
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    test("worker message errors and client construction failures clean up", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.ready.mockImplementation(() => {
            queueMicrotask(() => worker.onmessageerror?.({} as MessageEvent));
            return new Promise(() => undefined);
        });
        expect((await executePython(executionOptions(worker, client))).stderr).toContain(
            "could not be decoded"
        );
        const secondWorker = new FakeWorker();
        expect(
            (
                await executePython({
                    ...executionOptions(secondWorker, client),
                    workerClientFactory: () => {
                        throw new Error("client failed");
                    }
                })
            ).stderr
        ).toContain("client failed");
        expect(secondWorker.terminate).toHaveBeenCalledOnce();
        expect(
            (
                await executePython({
                    ...executionOptions(secondWorker, client),
                    workerFactory: () => {
                        throw new Error("worker failed");
                    }
                })
            ).stderr
        ).toContain("worker failed");
    });

    test.each([
        Number.NaN,
        Number.NEGATIVE_INFINITY
    ])("rejects invalid deadlines before dispatch: %s", async (duration) => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        expect(
            (await executePython({...executionOptions(worker, client), startupTimeoutMs: duration}))
                .exitCode
        ).toBe(1);
        expect(client.ready).not.toHaveBeenCalled();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test.each([0, -1])("normalizes immediate deadlines: %s", async (duration) => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.ready.mockImplementation(() => new Promise(() => undefined));
        expect(
            (await executePython({...executionOptions(worker, client), startupTimeoutMs: duration}))
                .exitCode
        ).toBe(124);
    });

    test("clears timeout timers and caller listeners on success", async () => {
        vi.useFakeTimers();
        try {
            const worker = new FakeWorker();
            const client = new FakeWorkerClient();
            const controller = new AbortController();
            const remove = vi.spyOn(controller.signal, "removeEventListener");
            const options = executionOptions(worker, client);
            delete options.runtimeBaseUrl;
            expect((await executePython({...options, signal: controller.signal})).exitCode).toBe(0);
            expect(client.ready).toHaveBeenCalledWith(new URL("pyodide/", document.baseURI).href);
            expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
});
