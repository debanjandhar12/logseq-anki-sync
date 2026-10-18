// @vitest-environment node
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {JustBashWrapper} from "../../../../src/core/just-bash-wrapper/JustBashWrapper";
import type {CreateLogseqBridge} from "../../../../src/core/just-bash-wrapper/pyodide/logseq-lib/types";
import {BashCommand} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import {PutCommandFileCommand} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/PutCommandFileCommand";
import {ReadCommandFileCommand} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/ReadCommandFileCommand";
import {LogseqReversibleTransactionTracker} from "../../../../src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTracker";
import {LogseqReversibleTransactionTrackerSerializer as Serializer} from "../../../../src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTrackerSerializer";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {MustacheView} from "../../../../src/core/template-engine";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const markdown = (body: string) =>
    `---\nname: Example\ninvoke-location:\n  - Logseq Command Center\n---\n${body}`;
vi.mock("@logseq/libs", () => ({}));
vi.hoisted(() => {
    Object.assign(globalThis, {logseq: {baseInfo: {id: "test-plugin"}, settings: {}}});
});
beforeEach(() => {
    InMemoryStore.clearAll();
    Storage.store = new InMemoryStore("bash-command");
    vi.stubGlobal("logseq", {baseInfo: {id: "test-plugin"}});
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue([]);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mockShell(run: (lib: {createBridge: CreateLogseqBridge}) => Promise<void>, exitCode = 1) {
    return vi.spyOn(JustBashWrapper, "createExecutionInstance").mockImplementation(
        async (createBridge) =>
            ({
                exec: async () => {
                    await run({createBridge});
                    return {stdout: "recorded output", stderr: "script error", exitCode};
                }
            }) as unknown as Awaited<ReturnType<typeof JustBashWrapper.createExecutionInstance>>
    );
}

test("keeps successful children, drops failed children, and replays without rerunning Bash", async () => {
    const shell = mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        try {
            await bridge.call("save_command_file", {
                commandName: "Example",
                content: markdown("first")
            });
            await expect(bridge.call("delete_page", {pageUuid: "invalid"})).rejects.toThrow();
            const result = await bridge.call("read_command_file", {commandName: "Example"});
            expect(result).toMatchObject({exists: true, content: markdown("first")});
            await bridge.call("save_command_file", {
                commandName: "Example",
                content: markdown("second")
            });
        } finally {
            await close();
        }
    });
    const bash = new BashCommand({command: "python first.py; python second.py"});
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(bash);
    expect(await tracker.execute()).toMatchObject({exitCode: 1});
    expect(bash.getCommands()).toHaveLength(3);
    const restored = Serializer.deserialize(
        JSON.parse(JSON.stringify(Serializer.serialize(tracker)))
    );
    await restored.revertAppliedCommands();
    expect(await CommandFileStore.getCommandFileByName("Example")).toBeNull();
    await restored.execute();
    expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(
        markdown("second")
    );
    expect(shell).toHaveBeenCalledOnce();
}, 15_000);

test("serializes concurrent calls and revokes closed worker bridges", async () => {
    mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        const save = bridge.call("save_command_file", {
            commandName: "Example",
            content: markdown("saved")
        });
        const read = bridge.call("read_command_file", {commandName: "Example"});
        expect(await save).toBe(true);
        expect(await read).toMatchObject({content: markdown("saved")});
        await close();
        await expect(bridge.call("delete_command_file", {commandName: "Example"})).rejects.toThrow(
            "ended"
        );
    }, 0);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(new BashCommand({command: "python -c pass"}));
    await tracker.execute();
    expect(tracker.hasAppliedGraphMutations()).toBe(true);
});

test("read-only Bash produces no graph mutations", async () => {
    mockShell(async () => {}, 0);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(new BashCommand({command: "echo hello"}));
    await tracker.execute();
    expect(tracker.hasAppliedGraphMutations()).toBe(false);
    await tracker.revertAppliedCommands();
});

test("a started Bash command finishes without receiving the caller's abort signal", async () => {
    const controller = new AbortController();
    const exec = vi.fn(async () => {
        controller.abort();
        return {stdout: "finished", stderr: "", exitCode: 0};
    });
    vi.spyOn(JustBashWrapper, "createExecutionInstance").mockResolvedValue({
        exec
    } as unknown as Awaited<ReturnType<typeof JustBashWrapper.createExecutionInstance>>);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(new BashCommand({command: "echo finished"}));
    await expect(tracker.execute({signal: controller.signal})).resolves.toMatchObject({
        stdout: "finished"
    });
    expect(exec).toHaveBeenCalledWith("echo finished", {cwd: undefined});
    expect(tracker.getAppliedCommandCount()).toBe(1);
});

test("close drains started operations and rejects queued work after cancellation", async () => {
    let completeWrite!: () => void;
    let started!: () => void;
    const writing = new Promise<void>((resolve) => {
        started = resolve;
    });
    const original = PutCommandFileCommand.prototype.execute;
    vi.spyOn(PutCommandFileCommand.prototype, "execute").mockImplementation(async function () {
        started();
        await new Promise<void>((resolve) => {
            completeWrite = resolve;
        });
        return original.call(this);
    });
    mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        const save = bridge.call("save_command_file", {
            commandName: "Example",
            content: markdown("saved")
        });
        await writing;
        const queued = bridge.call("delete_command_file", {commandName: "Example"});
        const rejected = expect(queued).rejects.toThrow("ended");
        const closing = close();
        completeWrite();
        await closing;
        expect(await save).toBe(true);
        await rejected;
    });
    const tracker = new LogseqReversibleTransactionTracker();
    const bash = new BashCommand({command: "python -c pass"});
    tracker.addCommand(bash);
    await tracker.execute();
    expect(bash.getCommands()).toHaveLength(1);
    await tracker.revertAppliedCommands();
    expect(await CommandFileStore.getCommandFileByName("Example")).toBeNull();
});

test("replay failures remove the failed child and keep earlier successes undoable", async () => {
    const shell = mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        try {
            await bridge.call("save_command_file", {
                commandName: "Example",
                content: markdown("first")
            });
            await bridge.call("save_command_file", {
                commandName: "Example",
                content: markdown("second")
            });
        } finally {
            await close();
        }
    }, 0);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(new BashCommand({command: "python -c pass"}));
    await tracker.execute();
    await tracker.revertAppliedCommands();
    const original = PutCommandFileCommand.prototype.execute;
    const replay = vi.spyOn(PutCommandFileCommand.prototype, "execute");
    replay.mockImplementationOnce(original).mockRejectedValueOnce(new Error("replay failed"));
    tracker.addCommand(new BashCommand({command: "echo next"}));
    await expect(tracker.execute()).rejects.toThrow("replay failed");
    expect(tracker.getAppliedCommandCount()).toBe(1);
    expect(shell).toHaveBeenCalledOnce();
    expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(
        markdown("first")
    );
    const restored = Serializer.deserialize(
        JSON.parse(JSON.stringify(Serializer.serialize(tracker)))
    );
    expect((restored.getCommands()[0] as BashCommand).getCommands()).toHaveLength(1);
    replay.mockRestore();
    await restored.revertAppliedCommands();
    expect(await CommandFileStore.getCommandFileByName("Example")).toBeNull();
    // The pending new shell invocation is unrelated to the recorded writes.
    shell.mockImplementation(
        async () =>
            ({
                exec: async () => ({stdout: "next", stderr: "", exitCode: 0})
            }) as unknown as Awaited<ReturnType<typeof JustBashWrapper.createExecutionInstance>>
    );
    await restored.execute();
    expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(
        markdown("first")
    );
    expect(shell).toHaveBeenCalledTimes(2);
}, 15_000);

test("preceding pending commands execute before Python reads", async () => {
    mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        try {
            expect(await bridge.call("read_command_file", {commandName: "Example"})).toMatchObject({
                exists: true,
                content: markdown("baseline")
            });
        } finally {
            await close();
        }
    }, 0);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(
        new PutCommandFileCommand({commandName: "Example", content: markdown("baseline")})
    );
    tracker.addCommand(new BashCommand({command: "python -c pass"}));
    await tracker.execute();
});

test("partial child undo can be serialized and retried without repeating successful undos", async () => {
    mockShell(async (lib) => {
        const {bridge, close} = lib.createBridge();
        try {
            await bridge.call("save_command_file", {
                commandName: "Example",
                content: markdown("saved")
            });
            await bridge.call("read_command_file", {commandName: "Example"});
        } finally {
            await close();
        }
    }, 0);
    const tracker = new LogseqReversibleTransactionTracker();
    tracker.addCommand(new BashCommand({command: "python -c pass"}));
    await tracker.execute();
    const readUndo = vi.spyOn(ReadCommandFileCommand.prototype, "revert");
    const writeUndo = vi.spyOn(PutCommandFileCommand.prototype, "revert");
    writeUndo.mockRejectedValueOnce(new Error("undo failed"));
    await expect(tracker.revertAppliedCommands()).rejects.toThrow("undo failed");
    const restored = Serializer.deserialize(
        JSON.parse(JSON.stringify(Serializer.serialize(tracker)))
    );
    await restored.revertAppliedCommands();
    expect(readUndo).toHaveBeenCalledOnce();
    expect(await CommandFileStore.getCommandFileByName("Example")).toBeNull();
});
