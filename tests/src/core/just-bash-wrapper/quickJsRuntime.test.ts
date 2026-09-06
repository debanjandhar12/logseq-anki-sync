import type {SecureFetch} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {executeQuickJs} from "../../../../src/core/just-bash-wrapper/qjs/quickJsRuntime";
import type {
    QuickJsWorkerRequest,
    QuickJsWorkerResponse
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
    onmessage: ((event: MessageEvent<QuickJsWorkerResponse>) => void) | null = null;
    postMessage = vi.fn<(message: QuickJsWorkerRequest) => void>();
    terminate = vi.fn();

    respond(response: QuickJsWorkerResponse): void {
        this.onmessage?.({data: response} as MessageEvent<QuickJsWorkerResponse>);
    }
}

describe("QuickJS worker orchestration", () => {
    test("returns a worker result and terminates the worker", async () => {
        const worker = new FakeWorker();
        const execution = executeQuickJs({
            code: "console.log(2)",
            fileName: "test.js",
            args: [],
            cwd: "/home/user",
            env: {},
            fetch,
            workerFactory: () => worker as unknown as Worker
        });

        worker.respond({type: "result", result: {stdout: "2\n", stderr: "", exitCode: 0}});

        await expect(execution).resolves.toEqual({stdout: "2\n", stderr: "", exitCode: 0});
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("executes fetch requests on the host and returns their result", async () => {
        const worker = new FakeWorker();
        const hostFetch = vi.fn(fetch);
        executeQuickJs({
            code: "",
            fileName: "test.js",
            args: [],
            cwd: "/home/user",
            env: {},
            fetch: hostFetch,
            workerFactory: () => worker as unknown as Worker
        });

        worker.respond({
            type: "fetch",
            id: 3,
            url: "https://example.com",
            options: {method: "GET"}
        });
        await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2));

        expect(hostFetch).toHaveBeenCalledWith(
            "https://example.com",
            expect.objectContaining({method: "GET", signal: expect.any(AbortSignal)})
        );
        expect(worker.postMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({type: "fetch-result", id: 3})
        );
    });

    test("hard-terminates an unresponsive worker", async () => {
        const worker = new FakeWorker();

        await expect(
            executeQuickJs({
                code: "while (true) {}",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch,
                executionTimeoutMs: 20,
                workerFactory: () => worker as unknown as Worker
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 124}));
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("immediately terminates for an already-aborted signal", async () => {
        const worker = new FakeWorker();
        const controller = new AbortController();
        controller.abort();

        await expect(
            executeQuickJs({
                code: "",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch,
                signal: controller.signal,
                workerFactory: () => worker as unknown as Worker
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 124}));
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("cleans up after synchronous postMessage failures", async () => {
        const worker = new FakeWorker();
        worker.postMessage.mockImplementation(() => {
            throw new Error("clone failed");
        });

        await expect(
            executeQuickJs({
                code: "",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch,
                workerFactory: () => worker as unknown as Worker
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 1, stderr: "qjs: clone failed\n"}));
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
});
