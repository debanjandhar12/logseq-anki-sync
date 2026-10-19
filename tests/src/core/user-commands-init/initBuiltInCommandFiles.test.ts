import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {renderCommandFileTemplate} from "../../../../src/core/command-parser";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {initBuiltInCommandFiles} from "../../../../src/core/user-commands-init/initBuiltInCommandFiles";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const ADD_AS_ATTACHMENT_FILE_NAME = "Add as attachment.md";
const ADD_TO_CHAT_FILE_NAME = "Add to Chat.md";
const TRANSFORMATION_COMMAND_NAMES = [
    "Transcribe Video",
    "Translate to English",
    "Fix Content",
    "Summarize Content",
    "Evaluate Math"
];

function createCommandSource(name: string, metadata = "", body = "Prompt"): string {
    return `---\nname: ${name}\ninvoke-location:\n  - Block Slash Command\n${metadata}---\n${body}`;
}

describe("initBuiltInCommandFiles", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("built-in-command-test");
    });
    afterEach(() => vi.restoreAllMocks());

    test.each(
        TRANSFORMATION_COMMAND_NAMES
    )("installs %s with the intended invocation settings", async (name) => {
        await initBuiltInCommandFiles();
        const command = (await CommandFileStore.getCommandFile(`${name}.md`))!;
        const attachment = (await CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME))!;

        expect(command).toEqual(
            expect.objectContaining({
                name,
                userInvocable: true,
                builtInCommand: true,
                builtInCommandUserControllable: true,
                commandInvokeInNewThread: true,
                commandAutoSend: name === "Translate to English",
                commandAppearSeparatelyInContextMenu: false,
                invokeLocations:
                    name === "Transcribe Video"
                        ? ["Block Context Menu/Video"]
                        : name === "Evaluate Math"
                          ? ["Block Context Menu/Math"]
                          : attachment.invokeLocations
            })
        );
        const prompt = await renderCommandFileTemplate(command.content, {} as never);
        expect(prompt.trim().length).toBeGreaterThan(0);
        expect(prompt).not.toContain("built-in-command:");
        if (name === "Transcribe Video") {
            expect(prompt).toContain("{{youtube-timestamp N}}");
            expect(prompt).toContain("working-with-bash-and-pyodide");
            expect(prompt).toContain("logseq-video-and-web-embeds");
        }
        if (name === "Evaluate Math") {
            expect(prompt).toContain("SYMPY_INTEGRATION.py");
            expect(prompt).toContain("sympy==1.14.0");
            expect(prompt).toContain("SymPy Gamma");
        }
    });

    test.each(
        TRANSFORMATION_COMMAND_NAMES
    )("preserves a same-name user-owned %s command", async (name) => {
        const source = createCommandSource(name);
        await CommandFileStore.saveCommandFile(source);
        await initBuiltInCommandFiles();
        expect((await CommandFileStore.getCommandFile(`${name}.md`))?.content).toBe(source);
    });

    test.each(
        TRANSFORMATION_COMMAND_NAMES
    )("repairs %s while preserving its disabled state", async (name) => {
        await initBuiltInCommandFiles();
        const original = (await CommandFileStore.getCommandFile(`${name}.md`))!.content;
        await CommandFileStore.saveCommandFile(
            original.replace("user-invocable: true", "user-invocable: false") + "\nUnwanted edit"
        );

        await initBuiltInCommandFiles();
        const updated = (await CommandFileStore.getCommandFile(`${name}.md`))!;
        expect(updated.userInvocable).toBe(false);
        expect(updated.content).not.toContain("Unwanted edit");
        expect(await renderCommandFileTemplate(updated.content, {} as never)).toBe(
            await renderCommandFileTemplate(original, {} as never)
        );
    });

    test("unchanged bundles perform no writes on reinitialization", async () => {
        await initBuiltInCommandFiles();
        expect(await CommandFileStore.getAllCommandFiles()).toHaveLength(7);
        const save = vi.spyOn(CommandFileStore, "saveCommandFile");
        const remove = vi.spyOn(CommandFileStore, "deleteCommandFile");
        await initBuiltInCommandFiles();
        expect(save).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });

    test("installs the controllable Add to Chat command as a separate menu item", async () => {
        await initBuiltInCommandFiles();
        const attachment = (await CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME))!;

        await expect(CommandFileStore.getCommandFile(ADD_TO_CHAT_FILE_NAME)).resolves.toEqual(
            expect.objectContaining({
                name: "Add to Chat",
                userInvocable: true,
                commandInvokeInNewThread: false,
                commandAutoSend: false,
                commandAppearSeparatelyInContextMenu: true,
                builtInCommand: true,
                builtInCommandUserControllable: true,
                invokeLocations: attachment.invokeLocations
            })
        );
    });

    test("installs the locked Add as attachment command with an empty body", async () => {
        await initBuiltInCommandFiles();

        await expect(CommandFileStore.getCommandFile(ADD_AS_ATTACHMENT_FILE_NAME)).resolves.toEqual(
            expect.objectContaining({
                name: "Add as attachment",
                userInvocable: true,
                commandInvokeInNewThread: false,
                commandAutoSend: false,
                builtInCommand: true,
                builtInCommandUserControllable: false,
                invokeLocations: [
                    "Block Context Menu/Image",
                    "Block Context Menu/Pdf",
                    "Block Context Menu/Video",
                    "Block Context Menu/Flashcard",
                    "Block Context Menu/Math",
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

    test("replaces the renamed Fix and Summarize built-ins", async () => {
        await CommandFileStore.saveCommandFile(
            createCommandSource(
                "Fix",
                "built-in-command: true\nbuilt-in-command-user-controllable: true\n"
            )
        );
        await CommandFileStore.saveCommandFile(
            createCommandSource(
                "Summarize",
                "built-in-command: true\nbuilt-in-command-user-controllable: true\n"
            )
        );

        await initBuiltInCommandFiles();

        await expect(CommandFileStore.getCommandFile("Fix.md")).resolves.toBeNull();
        await expect(CommandFileStore.getCommandFile("Summarize.md")).resolves.toBeNull();
        await expect(CommandFileStore.getCommandFile("Fix Content.md")).resolves.not.toBeNull();
        await expect(
            CommandFileStore.getCommandFile("Summarize Content.md")
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
