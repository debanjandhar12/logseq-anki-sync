import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

function createCommandSource(name: string, condition = "Block Slash Command") {
    return `---\nname: ${name}\ninvoke-condition:\n  - ${condition}\n---\nPrompt`;
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
        expect(CommandFileStore.getCommandFileNameFromContent(createCommandSource("Parsed"))).toBe(
            "Parsed.md"
        );
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
    });

    test("sorts valid commands and skips malformed files", async () => {
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Zed.md",
            createCommandSource("Zed")
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

        await expect(CommandFileStore.getAllCommandFiles()).resolves.toEqual([
            expect.objectContaining({name: "Alpha"}),
            expect.objectContaining({name: "Zed"})
        ]);
        await expect(CommandFileStore.getCommandFile("broken.md")).resolves.toBeNull();
    });

    test("retains physical filenames when listing stored commands", async () => {
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            "Old name.md",
            createCommandSource("New name")
        );

        await expect(CommandFileStore.getAllStoredCommandFiles()).resolves.toEqual([
            {
                fileName: "Old name.md",
                commandFile: expect.objectContaining({name: "New name"})
            }
        ]);
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
