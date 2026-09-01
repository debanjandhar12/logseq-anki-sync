import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

function createCommandSource(
    name: string,
    location = "Block Slash Command",
    builtInCommand = false
) {
    return `---\nname: ${name}\ninvoke-location:\n  - ${location}\nbuilt-in-command: ${builtInCommand}\n---\nPrompt`;
}

describe("CommandFileStore", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("command-store-test");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("derives filenames from parsed command names", () => {
        expect(CommandFileStore.getCommandFileName({name: "Test"})).toBe("Test.md");
    });

    test("saves and loads raw command Markdown", async () => {
        const source = createCommandSource("Saved command");
        await CommandFileStore.saveCommandFile(source);

        await expect(CommandFileStore.getCommandFile("Saved command.md")).resolves.toMatchObject({
            name: "Saved command",
            content: source
        });
        await expect(CommandFileStore.getCommandFileByName("Saved command")).resolves.toMatchObject(
            {name: "Saved command"}
        );
        await expect(CommandFileStore.commandFileExists("Saved command.md")).resolves.toBe(true);
        await expect(CommandFileStore.commandFileExists("Missing.md")).resolves.toBe(false);
    });

    test("sorts built-in commands before user commands and skips malformed files", async () => {
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Zed.md",
            createCommandSource("Zed", "Block Slash Command", true)
        );
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "broken.md",
            "not a command"
        );
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Alpha.md",
            createCommandSource("Alpha")
        );
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Yankee.md",
            createCommandSource("Yankee", "Block Slash Command", true)
        );
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Bravo.md",
            createCommandSource("Bravo")
        );

        await expect(CommandFileStore.getAllCommandFiles()).resolves.toEqual([
            expect.objectContaining({name: "Yankee", builtInCommand: true}),
            expect.objectContaining({name: "Zed", builtInCommand: true}),
            expect.objectContaining({name: "Alpha", builtInCommand: false}),
            expect.objectContaining({name: "Bravo", builtInCommand: false})
        ]);
        await expect(CommandFileStore.getCommandFile("broken.md")).resolves.toBeNull();
    });

    test("skips a file that cannot be read without hiding valid commands", async () => {
        await CommandFileStore.saveCommandFile(createCommandSource("Readable"));
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Unreadable.md",
            createCommandSource("Unreadable")
        );
        const getFileContent = LogseqPluginStorageManager.getFileContent.bind(
            LogseqPluginStorageManager
        );
        vi.spyOn(LogseqPluginStorageManager, "getFileContent").mockImplementation(
            (groupName, fileName) =>
                fileName === "Unreadable.md"
                    ? Promise.reject(new Error("read failed"))
                    : getFileContent(groupName, fileName)
        );

        await expect(CommandFileStore.getAllCommandFiles()).resolves.toEqual([
            expect.objectContaining({name: "Readable"})
        ]);
    });

    test("deletes command files", async () => {
        await CommandFileStore.saveCommandFile(createCommandSource("Delete me"));
        await CommandFileStore.deleteCommandFile("Delete me.md");

        await expect(CommandFileStore.getCommandFile("Delete me.md")).resolves.toBeNull();
    });

    test("propagates deletion failures", async () => {
        vi.spyOn(LogseqPluginStorageManager, "deleteFile").mockRejectedValue(
            new Error("delete failed")
        );

        await expect(CommandFileStore.deleteCommandFile("Command.md")).rejects.toThrow(
            "delete failed"
        );
    });
});
