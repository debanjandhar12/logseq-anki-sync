import {beforeEach, describe, expect, test} from "vitest";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {initBuiltInCommandFiles} from "../../../../src/core/user-commands/initBuiltInCommandFiles";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const ADD_AS_ATTACHMENT_FILE_NAME = "Add as attachment.md";

function createCommandSource(name: string, metadata = "", body = "Prompt"): string {
    return `---\nname: ${name}\ninvoke-condition:\n  - Block Slash Command\n${metadata}---\n${body}`;
}

describe("initBuiltInCommandFiles", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("built-in-command-test");
    });

    test("installs the locked Add as attachment command with an empty body", async () => {
        await initBuiltInCommandFiles();

        await expect(CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME)).resolves.toEqual(
            expect.objectContaining({
                name: "Add as attachment",
                userInvocable: true,
                commandInvokeInNewThread: false,
                builtInCommand: true,
                builtInCommandUserControllable: false,
                invokeConditions: [
                    "Block Context Menu/Image",
                    "Block Context Menu/Pdf",
                    "Block Context Menu/Video",
                    "Block Context Menu/Flashcard",
                    "Block Context Menu/Other Blocks",
                    "Page Context Menu/Tag",
                    "Page Context Menu/Property",
                    "Page Context Menu/Journal",
                    "Page Context Menu/Other Pages"
                ]
            })
        );
        const stored = await LogseqPluginStorageManager.getFileContent(
            CommandFileStore.groupName,
            ADD_AS_ATTACHMENT_FILE_NAME
        );
        expect(stored.endsWith("---\n")).toBe(true);
    });

    test("does not overwrite a same-name user command", async () => {
        const userCommand = createCommandSource("Add as attachment");
        await CommandFileStore.saveCommandFile(userCommand);

        await initBuiltInCommandFiles();

        await expect(
            LogseqPluginStorageManager.getFileContent(
                CommandFileStore.groupName,
                ADD_AS_ATTACHMENT_FILE_NAME
            )
        ).resolves.toBe(userCommand);
    });

    test("does not overwrite a malformed same-name file", async () => {
        await LogseqPluginStorageManager.saveFile(
            CommandFileStore.groupName,
            ADD_AS_ATTACHMENT_FILE_NAME,
            "malformed user content"
        );

        await initBuiltInCommandFiles();

        await expect(
            LogseqPluginStorageManager.getFileContent(
                CommandFileStore.groupName,
                ADD_AS_ATTACHMENT_FILE_NAME
            )
        ).resolves.toBe("malformed user content");
    });

    test("removes built-in commands that are no longer bundled", async () => {
        await CommandFileStore.saveCommandFile(
            createCommandSource("Obsolete", "built-in-command: true\n")
        );

        await initBuiltInCommandFiles();

        await expect(CommandFileStore.getCommandFile("Obsolete.md")).resolves.toBeNull();
        await expect(
            CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME)
        ).resolves.not.toBeNull();
    });

    test("restores locked built-in content and enabled state", async () => {
        await CommandFileStore.saveCommandFile(
            createCommandSource(
                "Add as attachment",
                "user-invocable: false\nbuilt-in-command: true\nbuilt-in-command-user-controllable: false\ncommand-invoke-in-new-thread: true\n",
                "Modified"
            )
        );

        await initBuiltInCommandFiles();

        await expect(CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME)).resolves.toEqual(
            expect.objectContaining({
                userInvocable: true,
                commandInvokeInNewThread: false,
                content: expect.not.stringContaining("Modified")
            })
        );
    });
});
