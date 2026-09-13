import {describe, expect} from "vitest";
import {page} from "vitest/browser";
import {test} from "../../helpers/skill-and-command-editor/fixtures";

describe("Basic command file editor operations", () => {
    test("built-in commands with built-in-command-user-controllable false cannot be disabled", async ({
        storage,
        editor
    }) => {
        await storage.seedCommand(`---
name: Built-in Uncontrollable
invoke-location:
  - Block Slash Command
user-invocable: true
built-in-command: true
built-in-command-user-controllable: false
---

Instructions.
`);

        const driver = await editor.mount("command");
        await expect.element(driver.file("Built-in Uncontrollable.md")).toBeVisible();
        await expect.element(driver.enabled).toBeDisabled();
    });

    test("built-in commands with built-in-command-user-controllable true can be disabled by user", async ({
        storage,
        editor
    }) => {
        await storage.seedCommand(`---
name: Built-in Controllable
invoke-location:
  - Block Slash Command
user-invocable: true
built-in-command: true
built-in-command-user-controllable: true
---

Instructions.
`);

        const driver = await editor.mount("command");
        await expect.element(driver.file("Built-in Controllable.md")).toBeVisible();
        await expect.element(driver.enabled).toBeEnabled();
        await expect.element(driver.enabled).toBeChecked();
        await driver.enabled.click();
        await expect.element(driver.enabled).not.toBeChecked();
        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect((await storage.getCommand("Built-in Controllable"))?.content).toContain(
            "user-invocable: false"
        );
        const reopened = await editor.mount("command");
        await expect.element(reopened.enabled).not.toBeChecked();
    });

    test("built-in commands cannot be deleted by user (delete button disabled)", async ({
        storage,
        editor
    }) => {
        await storage.seedCommand(`---
name: Built-in One
invoke-location:
  - Block Slash Command
built-in-command: true
built-in-command-user-controllable: false
---

Instructions one.
`);

        await storage.seedCommand(`---
name: Built-in Two
invoke-location:
  - Block Slash Command
built-in-command: true
built-in-command-user-controllable: true
---

Instructions two.
`);

        const driver = await editor.mount("command");
        await driver.file("Built-in One.md").click();
        await expect.element(driver.deleteButton).toBeDisabled();
        await driver.file("Built-in Two.md").click();
        await expect.element(driver.deleteButton).toBeDisabled();
    });

    test("new button creates a command and delete button removes it", async ({storage, editor}) => {
        const driver = await editor.mount("command");
        await driver.newButton.click();
        await expect.element(driver.file("New command.md")).toBeVisible();
        expect(await storage.getCommand("New command")).toBeNull();
        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect(await storage.getCommand("New command")).not.toBeNull();

        const driver2 = await editor.mount("command");
        await driver2.file("New command.md").click();
        await expect.element(driver2.deleteButton).toBeEnabled();
        await driver2.deleteButton.click();
        await expect.element(driver2.file("New command.md")).not.toBeInTheDocument();
        await driver2.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect(await storage.getCommand("New command")).toBeNull();
    });

    test("saving two command files with same name throws validation error", async ({
        storage,
        editor,
        messages
    }) => {
        const commandContent = `---
name: Duplicate Command
invoke-location:
  - Block Slash Command
user-invocable: true
---

Instructions.
`;
        await storage.seedCommand(commandContent);

        const driver = await editor.mount("command");
        await driver.newButton.click();
        await driver.content.fill(commandContent);

        await driver.saveButton.click();
        await expect
            .poll(() => messages.mock.calls)
            .toEqual([[expect.stringMatching(/Validation failed.*already uses/is), "error"]]);
        await expect.element(driver.dialog).toBeVisible();
    });

    test("click cancel asks confirmation if unsaved changes exist", async ({storage, editor}) => {
        await storage.seedCommand(`---
name: Original Command
invoke-location:
  - Block Slash Command
user-invocable: true
---

Original instructions.
`);

        const driver = await editor.mount("command");
        await driver.content.fill(`---
name: Original Command
invoke-location:
  - Block Slash Command
user-invocable: true
---

Modified instructions.
`);
        await driver.cancelButton.click();

        const confirmDialog = page.getByRole("dialog", {
            name: "You have unsaved command changes. Close without saving?",
            exact: true
        });
        await expect.element(confirmDialog).toBeVisible();
        await expect
            .element(confirmDialog.getByRole("button", {name: "Keep editing", exact: true}))
            .toBeVisible();
        await expect
            .element(confirmDialog.getByRole("button", {name: /^Close without saving/}))
            .toBeVisible();
        await confirmDialog.getByRole("button", {name: "Keep editing", exact: true}).click();
        await expect.element(confirmDialog).not.toBeInTheDocument();
        await expect.element(driver.dialog).toBeVisible();
        await expect
            .poll(() => driver.content.element().textContent)
            .toContain("Modified instructions.");
        expect((await storage.getCommand("Original Command"))?.content).toContain(
            "Original instructions."
        );
    });

    test("click cancel and then close without saving does not save changes to store", async ({
        storage,
        editor
    }) => {
        const original = `---
name: Unchanged Command
invoke-location:
  - Block Slash Command
user-invocable: true
---

Original instructions.
`;
        await storage.seedCommand(original);

        const driver = await editor.mount("command");
        await driver.content.fill(`---
name: Unchanged Command
invoke-location:
  - Block Slash Command
user-invocable: true
---

DISCARD THIS CHANGE.
`);
        await driver.cancelButton.click();
        const confirmDialog = page.getByRole("dialog", {
            name: "You have unsaved command changes. Close without saving?",
            exact: true
        });
        await confirmDialog.getByRole("button", {name: /^Close without saving/}).click();
        expect(await editor.result()).toBeNull();
        await expect.element(driver.dialog).not.toBeInTheDocument();
        expect((await storage.getCommand("Unchanged Command"))?.content).toBe(original);
    });

    test("invocation location popover opens and changes can be made", async ({storage, editor}) => {
        await storage.seedCommand(`---
name: Location Test
invoke-location:
  - Block Slash Command
user-invocable: true
---

Instructions.
`);

        const driver = await editor.mount("command");
        const invocationButton = driver.dialog.getByRole("button", {
            name: "Choose command invocation locations",
            exact: true
        });
        await invocationButton.click();

        const popover = page.getByRole("dialog", {
            name: "Command invocation locations",
            exact: true
        });
        await expect.element(popover).toBeVisible();
        await expect
            .element(popover.getByRole("checkbox", {name: "Logseq Command Center", exact: true}))
            .toBeVisible();
        await popover.getByRole("checkbox", {name: "Logseq Command Center", exact: true}).click();
        await expect
            .poll(() => driver.content.element().textContent)
            .toContain("Logseq Command Center");
        await invocationButton.click();
        await expect.element(popover).not.toBeInTheDocument();
        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect((await storage.getCommand("Location Test"))?.invokeLocations).toContain(
            "Logseq Command Center"
        );
    });
});
