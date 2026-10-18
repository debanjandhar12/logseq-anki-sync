// @vitest-environment node

import {type Endpoint, expose, proxy, releaseProxy, wrap} from "comlink";
import {loadPyodide, type PyodideInterface} from "pyodide";
import {beforeAll, expect, test, vi} from "vitest";
import {installLogseqLib} from "../../../../../../src/core/just-bash-wrapper/pyodide/logseq-lib/installLogseqLib";
import type {LogseqLibBridge} from "../../../../../../src/core/just-bash-wrapper/pyodide/logseq-lib/types";

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

test("a Comlink-proxied host bridge supports Python method calls", async () => {
    const {MessageChannel} = process.getBuiltinModule("worker_threads");
    const channel = new MessageChannel();
    expose(
        proxy({
            methods: ["read_command_file"],
            call: async (_method: string, args: Record<string, unknown>) => ({
                exists: true,
                content: args.commandName
            })
        }),
        channel.port1 as unknown as Endpoint
    );
    const remote = wrap<LogseqLibBridge>(channel.port2 as unknown as Endpoint);
    const uninstall = installLogseqLib(pyodide, {
        methods: await remote.methods,
        call: (method, args) => remote.call(method, args)
    });
    try {
        expect(
            await pyodide.runPythonAsync(`
import logseq_lib
result = await logseq_lib.read_command_file({"commandName": "Across worker boundary"})
result["content"]
`)
        ).toBe("Across worker boundary");
    } finally {
        uninstall();
        remote[releaseProxy]();
        channel.port1.close();
        channel.port2.close();
    }
});
