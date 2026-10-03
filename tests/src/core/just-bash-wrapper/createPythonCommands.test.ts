import {
    createCommandContext,
    encodeUtf8ToBytes,
    InMemoryFs,
    unsafeBytesFromLatin1
} from "just-bash";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {createPythonCommands} from "../../../../src/core/just-bash-wrapper/pyodide";
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

const [pythonCommand, python3Command, pyCommand] = createPythonCommands("python", "python3", "py");

function createContext(stdin = "", cwd = "/") {
    return createCommandContext({
        fs: new InMemoryFs(),
        cwd,
        env: new Map(),
        exportedEnv: {},
        stdin: encodeUtf8ToBytes(stdin),
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
        expect((await pyCommand.execute(["--help"], createContext())).stdout).toContain(
            "Usage: py"
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

    test("validates caller aliases without hard-coding interpreter names", async () => {
        expect(createPythonCommands()).toEqual([]);
        expect(() => createPythonCommands("py", "py")).toThrow("unique");
        expect(() => createPythonCommands(" ")).toThrow("whitespace");
        expect(() => createPythonCommands("")).toThrow("non-empty");
        const [custom] = createPythonCommands("custom-python");
        expect((await custom.execute(["--help"], createContext())).stdout).toContain(
            "Usage: custom-python"
        );
    });

    test.each([
        "--version",
        "-V"
    ])("returns version without starting Python: %s", async (option) => {
        for (const command of [pythonCommand, python3Command, pyCommand]) {
            expect((await command.execute([option, "ignored"], createContext())).stdout).toBe(
                "Python 3.14.2 (Pyodide 314.0.6)\n"
            );
        }
        expect(executePython).not.toHaveBeenCalled();
    });

    test.each([
        "--command",
        "--",
        "-m",
        "-hV",
        "--no-help",
        "--help=true",
        "-c=print(2)"
    ])("does not expand supported interpreter syntax: %s", async (option) => {
        expect(await pyCommand.execute([option], createContext())).toEqual({
            stdout: "",
            stderr: `py: unknown option ${JSON.stringify(option)}\n`,
            exitCode: 2
        });
        expect(executePython).not.toHaveBeenCalled();
    });

    test.each([
        "-value",
        "value = 'a=b'\nprint(value)"
    ])("preserves code and option-like argument tails: %s", async (code) => {
        await pythonCommand.execute(
            ["-c", code, "--help", "-V", "001", ""],
            createContext("café😀\n")
        );
        expect(executePython).toHaveBeenCalledWith(
            expect.objectContaining({code, args: ["--help", "-V", "001", ""], stdin: "café😀\n"})
        );
    });

    test.each([
        {args: []},
        {args: ["-", "--help", "001"]}
    ])("consumes stdin as source once: $args", async ({args}) => {
        await pythonCommand.execute(args, createContext("print('café😀')"));
        expect(executePython).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "print('café😀')",
                fileName: "<stdin>",
                stdin: "",
                args: args.slice(1)
            })
        );
    });

    test("preserves malformed UTF-8 replacement decoding", async () => {
        const context = createContext();
        context.stdin = unsafeBytesFromLatin1("\xff");
        await pythonCommand.execute(["-c", "print(input())"], context);
        expect(executePython).toHaveBeenCalledWith(expect.objectContaining({stdin: "�"}));
    });

    test("reports missing code, files, network and shebang-only input", async () => {
        expect((await pythonCommand.execute(["-c"], createContext())).stderr).toContain(
            "requires Python code"
        );
        expect((await pythonCommand.execute(["-c", ""], createContext())).stderr).toContain(
            "no input"
        );
        expect((await pythonCommand.execute(["missing.py"], createContext())).stderr).toContain(
            "No such file"
        );
        expect(
            (await pythonCommand.execute([], createContext("#!/usr/bin/python"))).stderr
        ).toContain("no input");
        const context = createContext();
        context.fetch = undefined;
        expect((await pythonCommand.execute(["-c", "print(2)"], context)).stderr).toContain(
            "network access is not configured"
        );
        expect(executePython).not.toHaveBeenCalled();
    });

    test("forwards script tails, cwd, exported environment and abort signal", async () => {
        const context = createContext("input", "/work");
        vi.spyOn(context.fs, "exists").mockResolvedValue(true);
        vi.spyOn(context.fs, "readFile").mockResolvedValue("print(2)");
        context.exportedEnv = {FOO: "bar"};
        context.signal = new AbortController().signal;
        await pyCommand.execute(["script.py", "-c", "001", ""], context);
        expect(executePython).toHaveBeenCalledWith(
            expect.objectContaining({
                args: ["-c", "001", ""],
                cwd: "/work",
                env: {FOO: "bar"},
                signal: context.signal,
                stdin: "input"
            })
        );
    });
});
