// @vitest-environment node
import {createCommandContext, InMemoryFs} from "just-bash";
import {beforeEach, expect, test, vi} from "vitest";
import {PythonCommandFactory} from "../../../../../src/core/just-bash-wrapper/commands/createPythonCommands";
import {executePython} from "../../../../../src/core/just-bash-wrapper/pyodide";

vi.mock("../../../../../src/core/just-bash-wrapper/pyodide", () => ({
    executePython: vi.fn(async () => ({stdout: "ok", stderr: "", exitCode: 0}))
}));

beforeEach(() => vi.clearAllMocks());

function context() {
    const fs = new InMemoryFs();
    fs.mkdirSync("/home/user", {recursive: true});
    return createCommandContext({
        fs,
        cwd: "/home/user",
        env: new Map(),
        fetch: async (url) => ({
            status: 200,
            statusText: "OK",
            headers: {},
            body: new Uint8Array(),
            url
        })
    });
}

test("captures the bridge provider once and creates a separate bridge for each Python invocation", async () => {
    const bridge = {methods: ["read_command_file"], call: vi.fn()};
    const close = vi.fn(async () => {});
    const createLogseqBridge = vi.fn(() => ({bridge, close}));
    const [python, python3, py] = new PythonCommandFactory({createLogseqBridge}).create(
        "python",
        "python3",
        "py"
    );

    await python.execute(["--help"], context());
    expect(createLogseqBridge).not.toHaveBeenCalled();
    for (const command of [python, python3, py]) {
        await command.execute(["-c", "pass"], context());
    }
    expect(createLogseqBridge).toHaveBeenCalledTimes(3);
    expect(executePython).toHaveBeenCalledWith(
        expect.objectContaining({logseqLib: bridge, finalize: close})
    );
});

test("factories without Logseq capabilities preserve ordinary Python execution", async () => {
    const [python] = new PythonCommandFactory().create("python");
    await expect(python.execute(["-c", "print(1)"], context())).resolves.toMatchObject({
        stdout: "ok",
        exitCode: 0
    });
    expect(executePython).toHaveBeenCalledWith(expect.objectContaining({logseqLib: undefined}));
});

test("rejects invalid or duplicate aliases", () => {
    const factory = new PythonCommandFactory();
    expect(() => factory.create("python", "python")).toThrow("unique");
    expect(() => factory.create("bad alias")).toThrow("whitespace");
});
