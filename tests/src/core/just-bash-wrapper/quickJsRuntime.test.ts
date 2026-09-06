import type {SecureFetch} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {executeQuickJs} from "../../../../src/core/just-bash-wrapper/qjs/quickJsRuntime";
import type {
    QuickJsExecutionResult,
    QuickJsWorkerExecution,
    QuickJsWorkerFetch
} from "../../../../src/core/just-bash-wrapper/qjs/workerProtocol";

const fetch: SecureFetch = async (url) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    body: new Uint8Array(),
    url
});

class FakeWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    terminate = vi.fn();
}

class FakeWorkerClient {
    ready = vi.fn<() => Promise<void>>(() => Promise.resolve());
    execute = vi.fn<
        (
            execution: QuickJsWorkerExecution,
            fetch: QuickJsWorkerFetch
        ) => Promise<QuickJsExecutionResult>
    >(() => Promise.resolve({stdout: "2\n", stderr: "", exitCode: 0}));
    release = vi.fn();
}

function executionOptions(worker: FakeWorker, client: FakeWorkerClient) {
    return {
        code: "console.log(2)",
        fileName: "test.js",
        args: [],
        cwd: "/home/user",
        env: {},
        fetch,
        workerFactory: () => worker as unknown as Worker,
        workerClientFactory: () => client
    };
}

describe("QuickJS worker orchestration", () => {
    test("waits for worker readiness before execution", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        let markReady: (() => void) | undefined;
        client.ready.mockImplementation(
            () =>
                new Promise((resolve) => {
                    markReady = resolve;
                })
        );

        const execution = executeQuickJs(executionOptions(worker, client));
        await Promise.resolve();
        expect(client.execute).not.toHaveBeenCalled();

        markReady?.();
        await expect(execution).resolves.toEqual({stdout: "2\n", stderr: "", exitCode: 0});
        expect(client.execute).toHaveBeenCalledOnce();
        expect(client.release).toHaveBeenCalledOnce();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("executes fetch callbacks on the host", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        const hostFetch = vi.fn(fetch);
        client.execute.mockImplementation(async (_execution, workerFetch) => {
            const response = JSON.parse(await workerFetch("https://example.com", {method: "GET"}));
            expect(response.body).toBe("");
            return {stdout: "", stderr: "", exitCode: 0};
        });

        await executeQuickJs({...executionOptions(worker, client), fetch: hostFetch});

        expect(hostFetch).toHaveBeenCalledWith(
            "https://example.com",
            expect.objectContaining({method: "GET", signal: expect.any(AbortSignal)})
        );
    });

    test("fails quickly when worker startup hangs", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.ready.mockImplementation(() => new Promise(() => undefined));

        await expect(
            executeQuickJs({...executionOptions(worker, client), startupTimeoutMs: 20})
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "qjs: worker startup timed out\n"})
        );
        expect(client.execute).not.toHaveBeenCalled();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("hard-terminates an unresponsive execution", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.execute.mockImplementation(() => new Promise(() => undefined));

        await expect(
            executeQuickJs({...executionOptions(worker, client), executionTimeoutMs: 20})
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "qjs: execution timed out\n"})
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("immediately terminates for an already-aborted signal", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        const controller = new AbortController();
        controller.abort();

        await expect(
            executeQuickJs({...executionOptions(worker, client), signal: controller.signal})
        ).resolves.toEqual(
            expect.objectContaining({exitCode: 124, stderr: "qjs: execution aborted\n"})
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("terminates when the worker reports a startup error", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.ready.mockImplementation(() => {
            queueMicrotask(() => worker.onerror?.({message: "WASM failed"} as ErrorEvent));
            return new Promise(() => undefined);
        });

        await expect(executeQuickJs(executionOptions(worker, client))).resolves.toEqual(
            expect.objectContaining({exitCode: 1, stderr: "qjs: WASM failed\n"})
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("terminates even when releasing the Comlink proxy fails", async () => {
        const worker = new FakeWorker();
        const client = new FakeWorkerClient();
        client.release.mockImplementation(() => {
            throw new Error("release failed");
        });

        await expect(executeQuickJs(executionOptions(worker, client))).resolves.toEqual({
            stdout: "2\n",
            stderr: "",
            exitCode: 0
        });
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
});
