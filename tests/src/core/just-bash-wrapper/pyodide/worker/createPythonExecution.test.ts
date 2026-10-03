// @vitest-environment node
import {loadPyodide, type PyodideInterface} from "pyodide";
import {beforeAll, describe, expect, test} from "vitest";
import {createPythonExecution} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createPythonExecution";

let pyodide: PyodideInterface;
let stdout = "";
let stderr = "";

beforeAll(async () => {
    const require = process.getBuiltinModule("module").createRequire(import.meta.url);
    const {dirname} = process.getBuiltinModule("path");
    pyodide = await loadPyodide({indexURL: dirname(require.resolve("pyodide/pyodide.asm.wasm"))});
    pyodide.setStdout({
        batched: (line) => {
            stdout += `${line}\n`;
        }
    });
    pyodide.setStderr({
        batched: (line) => {
            stderr += `${line}\n`;
        }
    });
}, 30_000);

async function execute(code: string) {
    stdout = "";
    stderr = "";
    const {bootstrap, source} = createPythonExecution({
        code,
        fileName: "quote'\\café.py",
        args: ["001", "😀", "line\nvalue"],
        stdin: "",
        cwd: "/work/café",
        env: {UNICODE_VALUE: "café\n'\\"}
    });
    pyodide.runPython(bootstrap);
    return pyodide.runPythonAsync(source);
}

describe("real Python command wrapper", () => {
    test.each([
        ["pass", 0],
        ["raise SystemExit()", 0],
        ["raise SystemExit(3)", 3],
        ["raise SystemExit(-2)", -2],
        ["raise SystemExit('message')", 1]
    ])("maps exit status for %s", async (code, expected) => {
        expect(await execute(code as string)).toBe(expected);
        if (expected === 1) expect(stderr).toBe("message\n");
    });

    test("isolates user globals from wrapper locals and previous executions", async () => {
        expect(
            await execute(
                "exit_code = 'bad'\nsys = None\n__run_python_command = None\nuser_marker = 1"
            )
        ).toBe(0);
        expect(
            await execute(
                "assert 'user_marker' not in globals()\nexit_code = 'bad'\nraise SystemExit(3)"
            )
        ).toBe(3);
    });

    test("supports top-level await and escaped argv, env, cwd and filenames", async () => {
        expect(
            await execute(
                `import asyncio, os, sys\nawait asyncio.sleep(0)\nassert __name__ == '__main__'\nassert __file__ == sys.argv[0]\nassert sys.argv[1:] == ['001', '😀', 'line\\nvalue']\nassert os.getcwd() == '/work/café'\nassert os.environ['UNICODE_VALUE'] == "café\\n'\\\\"\nprint('ok😀')`
            )
        ).toBe(0);
        expect(stdout).toBe("ok😀\n");
    });

    test("preserves user filename in ordinary exception traceback", async () => {
        try {
            await execute("raise ValueError('user failure')");
            expect.fail("expected Python exception");
        } catch (error) {
            expect(String(error)).toContain("user failure");
            expect(String(error)).toContain("quote'\\café.py");
        }
    });
});
