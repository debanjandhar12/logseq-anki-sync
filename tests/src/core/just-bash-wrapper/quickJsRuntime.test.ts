import type {SecureFetch} from "just-bash";
import {describe, expect, test} from "vitest";
import {executeQuickJs} from "../../../../src/core/just-bash-wrapper/qjs/quickJsRuntime";

const fetch: SecureFetch = async (url) => ({
    status: 200,
    statusText: "OK",
    headers: {"content-type": "application/json"},
    body: new TextEncoder().encode('{"answer":42}'),
    url
});

describe("QuickJS runtime", () => {
    test("waits for utility completion and returns", async () => {
        const execution = executeQuickJs({
            code: "globalThis.__utilityPromise = (async () => console.log((await (await fetch('https://example.com')).json()).answer))();",
            fileName: "test.js",
            args: [],
            cwd: "/home/user",
            env: {},
            fetch
        });

        await expect(execution).resolves.toEqual({stdout: "42\n", stderr: "", exitCode: 0});
    });

    test("returns guest errors without hanging", async () => {
        await expect(
            executeQuickJs({
                code: "throw new Error('broken')",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 1}));
    });

    test("returns when a host fetch never settles", async () => {
        const hangingFetch: SecureFetch = () => new Promise(() => {});

        await expect(
            executeQuickJs({
                code: "globalThis.__utilityPromise = fetch('https://example.com')",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch: hangingFetch,
                executionTimeoutMs: 20
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 124}));
    });

    test("stops execution at process.exit", async () => {
        await expect(
            executeQuickJs({
                code: "process.exit(7); console.log('unreachable')",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch
            })
        ).resolves.toEqual({stdout: "", stderr: "", exitCode: 7});
    });

    test("limits output retained by the host", async () => {
        await expect(
            executeQuickJs({
                code: "console.log('x'.repeat(1024 * 1024 + 1))",
                fileName: "test.js",
                args: [],
                cwd: "/home/user",
                env: {},
                fetch
            })
        ).resolves.toEqual(expect.objectContaining({exitCode: 1}));
    });
});
