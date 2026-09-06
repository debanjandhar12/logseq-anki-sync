import {describe, expect, test} from "vitest";
import {executeQuickJsInWorker} from "../../../../src/core/just-bash-wrapper/qjs/quickJsWorkerRuntime";

const fetch = async () =>
    JSON.stringify({
        status: 200,
        statusText: "OK",
        headers: {"content-type": "application/json"},
        body: '{"answer":42}',
        url: "https://example.com"
    });

describe("QuickJS worker runtime", () => {
    test("waits for utility completion", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: "globalThis.__utilityPromise = (async () => console.log((await (await fetch('https://example.com')).json()).answer))();",
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                fetch
            )
        ).resolves.toEqual({stdout: "42\n", stderr: "", exitCode: 0});
    });

    test("returns guest errors", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: "throw new Error('broken')",
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                fetch
            )
        ).resolves.toEqual(expect.objectContaining({exitCode: 1}));
    });

    test("stops execution at process.exit", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: "process.exit(7); console.log('unreachable')",
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                fetch
            )
        ).resolves.toEqual({stdout: "", stderr: "", exitCode: 7});
    });

    test("limits output retained by the worker", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: "console.log('x'.repeat(1024 * 1024 + 1))",
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                fetch
            )
        ).resolves.toEqual(expect.objectContaining({exitCode: 1}));
    });
});
