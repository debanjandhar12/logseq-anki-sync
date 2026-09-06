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

const execution = (code: string) => ({
    code,
    fileName: "test.js",
    args: [],
    cwd: "/home/user",
    env: {}
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

    test("imports HTTPS modules and resolves transitive CDN paths", async () => {
        const requestedUrls: string[] = [];
        const moduleFetch = async (url: string) => {
            requestedUrls.push(url);
            const body = url.endsWith("/entry.js")
                ? 'import {answer} from "/shared.js"; export const result = answer + 1;'
                : "export const answer = 41;";
            return JSON.stringify({
                status: 200,
                statusText: "OK",
                headers: {"content-type": "text/javascript"},
                body,
                url
            });
        };

        await expect(
            executeQuickJsInWorker(
                execution(
                    'import {result} from "https://cdn.example.com/entry.js"; console.log(result);'
                ),
                moduleFetch
            )
        ).resolves.toEqual({stdout: "42\n", stderr: "", exitCode: 0});
        expect(requestedUrls).toEqual([
            "https://cdn.example.com/entry.js",
            "https://cdn.example.com/shared.js"
        ]);
    });

    test("rejects bare module specifiers", async () => {
        await expect(
            executeQuickJsInWorker(execution('import value from "package-name";'), fetch)
        ).resolves.toEqual(
            expect.objectContaining({
                exitCode: 1,
                stderr: expect.stringContaining("module import denied")
            })
        );
    });

    test("rejects non-HTTPS module imports before fetching", async () => {
        let fetchCalled = false;

        await expect(
            executeQuickJsInWorker(
                execution('import value from "http://example.com/value.js";'),
                async () => {
                    fetchCalled = true;
                    return "";
                }
            )
        ).resolves.toEqual(
            expect.objectContaining({
                exitCode: 1,
                stderr: expect.stringContaining("module import denied")
            })
        );
        expect(fetchCalled).toBe(false);
    });

    test("rejects a module response from a different final URL", async () => {
        await expect(
            executeQuickJsInWorker(
                execution('import value from "https://example.com/value.js";'),
                async () =>
                    JSON.stringify({
                        status: 200,
                        statusText: "OK",
                        headers: {"content-type": "text/javascript"},
                        body: "export default 42;",
                        url: "https://other.example.com/value.js"
                    })
            )
        ).resolves.toEqual(
            expect.objectContaining({
                exitCode: 1,
                stderr: expect.stringContaining("module redirect denied")
            })
        );
    });

    test("supports sequential host fetches without corrupting QuickJS", async () => {
        let requestCount = 0;

        await expect(
            executeQuickJsInWorker(
                {
                    code: `globalThis.__utilityPromise = (async () => {
                        const first = await (await fetch('https://example.com/1')).json();
                        const second = await (await fetch('https://example.com/2')).json();
                        console.log(first.answer + second.answer);
                    })();`,
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                async () => {
                    requestCount++;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    return JSON.stringify({
                        status: 200,
                        statusText: "OK",
                        headers: {"content-type": "application/json"},
                        body: JSON.stringify({answer: requestCount}),
                        url: "https://example.com"
                    });
                }
            )
        ).resolves.toEqual({stdout: "3\n", stderr: "", exitCode: 0});
    });

    test("keeps the shared module healthy across sequential-fetch contexts", async () => {
        for (let execution = 0; execution < 10; execution++) {
            await expect(
                executeQuickJsInWorker(
                    {
                        code: `globalThis.__utilityPromise = (async () => {
                            await fetch('https://example.com/1');
                            await fetch('https://example.com/2');
                        })();`,
                        fileName: "test.js",
                        args: [],
                        cwd: "/home/user",
                        env: {}
                    },
                    fetch
                )
            ).resolves.toEqual({stdout: "", stderr: "", exitCode: 0});
        }
    });

    test("supports concurrent host fetches", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: `globalThis.__utilityPromise = Promise.all([
                        fetch('https://example.com/1'),
                        fetch('https://example.com/2'),
                        fetch('https://example.com/3')
                    ]).then(responses => console.log(responses.length));`,
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                fetch
            )
        ).resolves.toEqual({stdout: "3\n", stderr: "", exitCode: 0});
    });

    test("propagates rejected host fetches", async () => {
        await expect(
            executeQuickJsInWorker(
                {
                    code: "globalThis.__utilityPromise = fetch('https://example.com')",
                    fileName: "test.js",
                    args: [],
                    cwd: "/home/user",
                    env: {}
                },
                async () => {
                    throw new Error("network failed");
                }
            )
        ).resolves.toEqual(
            expect.objectContaining({
                exitCode: 1,
                stderr: expect.stringContaining("network failed")
            })
        );
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
