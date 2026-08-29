import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import type {
    CommandFileData,
    CommandInvokeCondition
} from "../../../../src/core/stores/command-file-store/types";

const {showPaletteMock} = vi.hoisted(() => ({showPaletteMock: vi.fn()}));

vi.mock("../../../../src/ui/launchers/showAICommandPaletteModal", () => ({
    showAICommandPaletteModal: showPaletteMock
}));

import {registerUserCommandEntryPoints} from "../../../../src/core/user-commands/registerCommandEntryPoints";

function commandFile(
    invokeConditions: CommandInvokeCondition[],
    overrides: Partial<CommandFileData> = {}
): CommandFileData {
    return {
        name: "Summarize",
        invokeConditions,
        userInvocable: true,
        commandInvokeInNewThread: false,
        commandAppearSeparatelyInContextMenu: false,
        content: `---\nname: Summarize\ninvoke-condition:\n${invokeConditions.map((condition) => `  - ${condition}`).join("\n")}\n---\nSummarize`,
        ...overrides
    };
}

describe("registerCommandEntryPoints", () => {
    const registerBlockContextMenuItem = vi.fn();
    const registerPageMenuItem = vi.fn();
    const registerCommandPalette = vi.fn();
    const registerSlashCommand = vi.fn();
    const showMsg = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("logseq", {
            baseInfo: {id: `test-plugin-${crypto.randomUUID()}`},
            App: {registerCommandPalette, registerPageMenuItem},
            Editor: {registerBlockContextMenuItem, registerSlashCommand},
            UI: {showMsg}
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        registerBlockContextMenuItem.mockReset();
        registerPageMenuItem.mockReset();
        registerCommandPalette.mockReset();
        registerSlashCommand.mockReset();
        showMsg.mockReset();
        showPaletteMock.mockReset();
    });

    test("registers context-menu and enabled direct entry points", async () => {
        vi.spyOn(CommandFileStore, "getAllCommandFiles").mockResolvedValue([
            commandFile(["Logseq Command Center", "Block Slash Command"])
        ]);

        await registerUserCommandEntryPoints();

        expect(registerBlockContextMenuItem).toHaveBeenCalledWith(
            "Invoke AI Command",
            expect.any(Function)
        );
        expect(registerPageMenuItem).toHaveBeenCalledWith(
            "Invoke AI Command",
            expect.any(Function)
        );
        expect(registerCommandPalette).toHaveBeenCalledWith(
            expect.objectContaining({label: "Summarize"}),
            expect.any(Function)
        );
        expect(registerSlashCommand).toHaveBeenCalledWith("Summarize", expect.any(Function));
    });

    test("registers opted-in commands as separate block and page menu items", async () => {
        vi.spyOn(CommandFileStore, "getAllCommandFiles").mockResolvedValue([
            commandFile(["Block Context Menu/Other Blocks", "Page Context Menu/Other Pages"], {
                name: "Add to Chat",
                commandAppearSeparatelyInContextMenu: true
            })
        ]);

        await registerUserCommandEntryPoints();

        expect(registerBlockContextMenuItem).toHaveBeenCalledWith(
            "Add to Chat",
            expect.any(Function)
        );
        expect(registerPageMenuItem).toHaveBeenCalledWith("Add to Chat", expect.any(Function));
    });
});
