import {describe, expect} from "vitest";
import {page} from "vitest/browser";
import {test} from "../../helpers/skill-and-command-editor/fixtures";

describe("Basic skill file editor operations", () => {
    test("built-in skills with built-in-skill-user-controllable false cannot be disabled", async ({
        storage,
        editor
    }) => {
        await storage.seedSkill(`---
name: built-in-uncontrollable
description: A built-in skill that cannot be controlled
built-in-skill: true
built-in-skill-user-controllable: false
disable-model-invocation: false
---

Instructions here.
`);

        const driver = await editor.mount("skill");
        await expect.element(driver.file("built-in-uncontrollable")).toBeVisible();
        // Checkbox should be disabled (built-in not controllable)
        await expect.element(driver.enabled).toBeDisabled();
        // The checked state is preserved
        await expect.element(driver.enabled).toBeChecked();
        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
    });

    test("built-in skills with built-in-skill-user-controllable true can be disabled by user", async ({
        storage,
        editor
    }) => {
        await storage.seedSkill(`---
name: built-in-controllable
description: A built-in skill that can be controlled
built-in-skill: true
built-in-skill-user-controllable: true
disable-model-invocation: false
---

Instructions here.
`);

        const driver = await editor.mount("skill");
        await expect.element(driver.file("built-in-controllable")).toBeVisible();
        await expect.element(driver.enabled).toBeEnabled();
        await expect.element(driver.enabled).toBeChecked();

        // Click to disable
        await driver.enabled.click();
        await expect.element(driver.enabled).not.toBeChecked();

        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
        const saved = await storage.getSkill("built-in-controllable");
        expect(saved?.content).toContain("disable-model-invocation: true");
    });

    test("built-in skills cannot be deleted by user (delete button disabled)", async ({
        storage,
        editor
    }) => {
        await storage.seedSkill(`---
name: built-in-one
description: First built-in skill
built-in-skill: true
built-in-skill-user-controllable: false
---

Instructions one.
`);

        await storage.seedSkill(`---
name: built-in-two
description: Second built-in skill
built-in-skill: true
built-in-skill-user-controllable: true
---

Instructions two.
`);

        const driver = await editor.mount("skill");
        await driver.file("built-in-one").click();
        await expect.element(driver.deleteButton).toBeDisabled();
        await driver.file("built-in-two").click();
        await expect.element(driver.deleteButton).toBeDisabled();
    });

    test("new button creates a skill and delete button removes it", async ({storage, editor}) => {
        const driver = await editor.mount("skill");
        await driver.newButton.click();
        await expect.element(driver.file("new-skill")).toBeVisible();
        expect(await storage.getSkill("new-skill")).toBeNull();
        await driver.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect(await storage.getSkill("new-skill")).not.toBeNull();

        const driver2 = await editor.mount("skill");
        await driver2.file("new-skill").click();
        await expect.element(driver2.deleteButton).toBeEnabled();
        await driver2.deleteButton.click();
        await expect.element(driver2.file("new-skill")).not.toBeInTheDocument();
        await driver2.saveButton.click();
        expect(await editor.result()).toBe(true);
        expect(await storage.getSkill("new-skill")).toBeNull();
    });

    test("saving two skill files with same name throws validation error", async ({
        storage,
        editor,
        messages
    }) => {
        const skillContent = `---
name: duplicate-skill
description: A skill
---

Instructions.
`;
        await storage.seedSkill(skillContent);

        const driver = await editor.mount("skill");
        await driver.newButton.click();
        await driver.content.fill(skillContent);

        await driver.saveButton.click();
        await expect
            .poll(() => messages.mock.calls)
            .toEqual([[expect.stringMatching(/Validation failed.*already uses/is), "error"]]);
        await expect.element(driver.dialog).toBeVisible();
    });

    test("click cancel asks confirmation if unsaved changes exist", async ({storage, editor}) => {
        await storage.seedSkill(`---
name: original-skill
description: An original skill
---

Original instructions.
`);

        const driver = await editor.mount("skill");
        await driver.content.fill(`---
name: original-skill
description: An original skill
---

Modified instructions.
`);
        await driver.cancelButton.click();

        const confirmDialog = page.getByRole("dialog", {
            name: "You have unsaved skill changes. Close without saving?",
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
        expect((await storage.getSkill("original-skill"))?.content).toContain(
            "Original instructions."
        );
    });

    test("click cancel and then close without saving does not save changes to store", async ({
        storage,
        editor
    }) => {
        const original = `---
name: unchanged-skill
description: A skill that should not be changed
---

Original instructions.
`;
        await storage.seedSkill(original);

        const driver = await editor.mount("skill");
        await driver.content.fill(`---
name: unchanged-skill
description: A skill that should not be changed
---

DISCARD THIS CHANGE.
`);
        await driver.cancelButton.click();
        const confirmDialog = page.getByRole("dialog", {
            name: "You have unsaved skill changes. Close without saving?",
            exact: true
        });
        await confirmDialog.getByRole("button", {name: /^Close without saving/}).click();
        expect(await editor.result()).toBeNull();
        await expect.element(driver.dialog).not.toBeInTheDocument();
        expect((await storage.getSkill("unchanged-skill"))?.content).toBe(original);
    });
});
