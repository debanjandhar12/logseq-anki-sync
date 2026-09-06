import {createCommandContext, InMemoryFs} from "just-bash";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {python3Command, pythonCommand} from "../../../../src/core/just-bash-wrapper/pyodide";
import {executePython} from "../../../../src/core/just-bash-wrapper/pyodide/pyodideRuntime";

vi.mock("../../../../src/core/just-bash-wrapper/pyodide/pyodideRuntime", () => ({
    executePython: vi.fn(async () => ({stdout: "ok\n", stderr: "", exitCode: 0}))
}));

const fetch = vi.fn(async (url: string) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    body: new Uint8Array(),
    url
}));

function createContext(stdin = "", cwd = "/") {
    return createCommandContext({
        fs: new InMemoryFs(),
        cwd,
        env: new Map(),
        exportedEnv: {},
        stdin: stdin as never,
        fetch
    });
}

describe("Pyodide Python commands", () => {
    beforeEach(() => {
        vi.mocked(executePython).mockClear();
    });

    test("registers python and python3 aliases", async () => {
        expect((await pythonCommand.execute(["--help"], createContext())).stdout).toContain(
            "Usage: python"
        );
        expect((await python3Command.execute(["--help"], createContext())).stdout).toContain(
            "Usage: python3"
        );
    });

    test("passes only Python execution data and piped stdin to the runtime", async () => {
        await expect(
            pythonCommand.execute(["-c", "print(input())", "first"], createContext("input\n"))
        ).resolves.toEqual(expect.objectContaining({stdout: "ok\n", exitCode: 0}));
        expect(executePython).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "print(input())",
                fileName: "<string>",
                args: ["first"],
                stdin: "input\n",
                cwd: "/",
                fetch: expect.any(Function)
            })
        );
    });

    test("loads script source through the Bash filesystem", async () => {
        const context = createContext("", "/work");
        vi.spyOn(context.fs, "exists").mockResolvedValue(true);
        vi.spyOn(context.fs, "readFile").mockResolvedValue("#!/usr/bin/env python\nprint('file')");

        await pythonCommand.execute(["script.py", "argument"], context);

        expect(executePython).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "print('file')",
                fileName: "/work/script.py",
                args: ["argument"]
            })
        );
    });

    test("reports unsupported options and missing input", async () => {
        expect((await pythonCommand.execute(["--unknown"], createContext())).exitCode).toBe(2);
        expect((await pythonCommand.execute([], createContext())).exitCode).toBe(2);
        expect(executePython).not.toHaveBeenCalled();
    });
});
