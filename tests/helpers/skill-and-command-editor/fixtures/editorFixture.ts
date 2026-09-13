import {test as baseTest, expect, type Mock, vi} from "vitest";
import {page} from "vitest/browser";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";
import {showCommandEditorModal} from "../../../../src/ui/launchers/showCommandEditorModal";
import {showSkillEditorModal} from "../../../../src/ui/launchers/showSkillEditorModal";
import {createIsolatedPluginStorage} from "../../createIsolatedPluginStorage";
import {mountLauncher} from "../../mountLauncher";
import type {EditorControls, EditorFixture, EditorKind} from "./types";

function editorControls(container: HTMLElement | ShadowRoot, kind: EditorKind): EditorControls {
    const root = page.elementLocator(container instanceof ShadowRoot ? container.host : container);
    return {
        root,
        dialog: root.getByRole("dialog", {
            name: kind === "skill" ? "Skills Editor" : "Command Editor",
            exact: true
        }),
        content: root.getByRole("textbox"),
        enabled: root.getByRole("checkbox", {name: "Enabled", exact: true}),
        newButton: root.getByTitle(kind === "skill" ? "New skill" : "New command file", {
            exact: true
        }),
        deleteButton: root.getByTitle(
            kind === "skill" ? "Delete skill and its resources" : "Delete command file",
            {exact: true}
        ),
        saveButton: root.getByRole("button", {name: "Save", exact: true}),
        cancelButton: root.getByRole("button", {name: "Cancel", exact: true}),
        file(displayName: string) {
            return root.getByRole("button", {name: displayName, exact: true});
        }
    };
}

function createStorageFixture() {
    const storage = createIsolatedPluginStorage("editor-scenario");
    return {
        ...storage,
        seedSkill: (content: string) => SkillStore.saveSkillFile(content),
        seedCommand: (content: string) => CommandFileStore.saveCommandFile(content),
        getSkill: (name: string) => SkillStore.getSkill(name),
        getCommand: (name: string) => CommandFileStore.getCommandFileByName(name)
    };
}

export const test = baseTest.extend<{
    storage: ReturnType<typeof createStorageFixture>;
    messages: Mock<typeof logseq.UI.showMsg>;
    editor: EditorFixture;
}>({
    storage: async ({task}, use) => {
        void task;
        const storage = createStorageFixture();
        try {
            await use(storage);
        } finally {
            await storage.dispose();
        }
    },
    messages: async ({task}, use) => {
        void task;
        // The HTTP API facade is a Proxy, so replace the namespace rather than spying on it.
        const previous = logseq.UI;
        const messages = vi.fn<typeof logseq.UI.showMsg>().mockResolvedValue("");
        logseq.UI = {...previous, showMsg: messages};
        try {
            await use(messages);
        } finally {
            logseq.UI = previous;
        }
    },
    editor: async ({storage, messages}, use) => {
        void storage;
        void messages;
        let mounted: Awaited<ReturnType<typeof mountLauncher>> | undefined;
        let kind: EditorKind;
        let expectedReloads = 0;
        const reload = vi.spyOn(WindowParentBridge, "reloadPlugin").mockImplementation(() => {});
        const editor: EditorFixture = {
            async mount(editorKind) {
                await editor.unmount();
                kind = editorKind;
                mounted = await mountLauncher(
                    kind === "skill" ? showSkillEditorModal : showCommandEditorModal
                );
                const controls = editorControls(mounted.container, kind);
                await expect.element(controls.dialog).toBeVisible();
                await expect.element(controls.newButton).toBeVisible();
                return controls;
            },
            async unmount() {
                await mounted?.unmount();
                mounted = undefined;
            },
            async result() {
                if (!mounted) throw new Error("Editor has not mounted");
                const result = await mounted.result;
                if (kind === "command" && result === true) {
                    // Command saves schedule a host reload on the next timer tick.
                    expectedReloads++;
                    await expect.poll(() => reload.mock.calls.length).toBe(expectedReloads);
                }
                return result;
            }
        };
        try {
            await use(editor);
        } finally {
            try {
                await editor.unmount();
            } finally {
                reload.mockRestore();
            }
        }
    }
});
