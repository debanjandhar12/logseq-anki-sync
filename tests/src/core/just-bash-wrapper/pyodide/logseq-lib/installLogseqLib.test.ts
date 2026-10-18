// @vitest-environment node

import {loadPyodide, type PyodideInterface} from "pyodide";
import {beforeAll, expect, test, vi} from "vitest";
import {installLogseqLib} from "../../../../../../src/core/just-bash-wrapper/pyodide/logseq-lib/installLogseqLib";

let pyodide: PyodideInterface;
beforeAll(async () => {
    const require = process.getBuiltinModule("module").createRequire(import.meta.url);
    const {dirname} = process.getBuiltinModule("path");
    pyodide = await loadPyodide({indexURL: dirname(require.resolve("pyodide/pyodide.asm.wasm"))});
}, 30_000);

test("registered methods accept nested dictionaries and return native Python values", async () => {
    const call = vi.fn(async (_method, args) => ({
        exists: true,
        content: "hello",
        nested: [true, null, args]
    }));
    const uninstall = installLogseqLib(pyodide, {methods: ["read_command_file"], call});
    try {
        expect(
            await pyodide.runPythonAsync(`
import logseq_lib
result = await logseq_lib.read_command_file({"commandName": "Example", "nested": {"items": [1, False]}})
assert type(result) is dict
assert type(result["nested"]) is list
assert result["nested"][0] is True
assert result["nested"][1] is None
assert result["nested"][2]["nested"]["items"] == [1, False]
result["content"]
`)
        ).toBe("hello");
        expect(call).toHaveBeenCalledWith("read_command_file", {
            commandName: "Example",
            nested: {items: [1, false]}
        });
    } finally {
        uninstall();
    }
});

test("Python can catch a host failure and call another generated method", async () => {
    const uninstall = installLogseqLib(pyodide, {
        methods: ["fail", "succeed"],
        call: async (method) => {
            if (method === "fail") throw new Error("host failure");
            return true;
        }
    });
    try {
        expect(
            await pyodide.runPythonAsync(`
import logseq_lib
try:
    await logseq_lib.fail({})
except Exception:
    pass
assert await logseq_lib.succeed({}) is True
try:
    await logseq_lib.succeed([])
except TypeError:
    rejected = True
rejected
`)
        ).toBe(true);
    } finally {
        uninstall();
    }
});
