import {startCompletion} from "@codemirror/autocomplete";
import {describe, expect} from "vitest";
import {userEvent} from "vitest/browser";
import {
    expectCompletionOptions,
    expectFrontmatterCompletionSuppressed
} from "../../helpers/skill-and-command-editor/assertions";
import {createCodeMirrorDriver} from "../../helpers/skill-and-command-editor/createCodeMirrorDriver";
import {test} from "../../helpers/skill-and-command-editor/fixtures";

const skillSource = `---
name: example-skill
description: Example skill
disable-model-invocation: false
---

# Primary heading

## Secondary heading

Instructions.
`;

describe("Skill file editor CodeMirror operations", () => {
    for (const controllable of [false, true]) {
        test(`built-in content is read-only (user-controllable: ${controllable})`, async ({
            storage,
            editor
        }) => {
            const source = skillSource.replace(
                "description: Example skill",
                `description: Example skill\nbuilt-in-skill: true\nbuilt-in-skill-user-controllable: ${controllable}`
            );
            await storage.seedSkill(source);
            const driver = await editor.mount("skill");
            const codeMirror = createCodeMirrorDriver(driver.content);
            await expect.element(driver.content).toHaveAttribute("contenteditable", "false");
            await driver.content.click();
            await userEvent.keyboard("Attempted edit");
            expect(codeMirror.text()).toBe(source);
            expect((await storage.getSkill("example-skill"))?.content).toBe(source);
        });
    }

    test("typing <% in the body suggests variables and inserts the selected variable", async ({
        storage,
        editor
    }) => {
        await storage.seedSkill(skillSource);
        const driver = await editor.mount("skill");
        const codeMirror = createCodeMirrorDriver(driver.content);
        await codeMirror.placeCursor(skillSource.length);
        await userEvent.keyboard("<%");
        await expectCompletionOptions(codeMirror, ["<% today %>", "<% tomorrow %>"]);
        await codeMirror.completionOption("<% today %>").click();
        await expect.poll(() => codeMirror.text()).toBe(`${skillSource}<% today %>`);
    });

    test("template variable completion is suppressed in frontmatter", async ({storage, editor}) => {
        await storage.seedSkill(skillSource);
        const driver = await editor.mount("skill");
        const codeMirror = createCodeMirrorDriver(driver.content);
        // Establish that completion is working before checking its frontmatter exclusion.
        await codeMirror.placeCursor(skillSource.length);
        await userEvent.keyboard("<%");
        await expectCompletionOptions(codeMirror, ["<% today %>"]);
        await userEvent.keyboard("{Escape}");
        const position = skillSource.indexOf("description: ") + "description: ".length;
        await codeMirror.placeCursor(position);
        await userEvent.keyboard("<%");
        startCompletion(codeMirror.view());
        await expectFrontmatterCompletionSuppressed(codeMirror, position);
    });

    test("Markdown headers are bold and underlined", async ({storage, editor}) => {
        await storage.seedSkill(skillSource);
        const driver = await editor.mount("skill");
        for (const name of ["Primary heading", "Secondary heading"]) {
            const heading = driver.content.getByText(new RegExp(`^#+ ${name}$`));
            await expect.element(heading).toBeVisible();
            expect(Number(getComputedStyle(heading.element()).fontWeight)).toBeGreaterThanOrEqual(
                600
            );
            expect(getComputedStyle(heading.element()).textDecorationLine).toContain("underline");
        }
    });

    test("disable-model-invocation offers true and false completions", async ({
        storage,
        editor
    }) => {
        await storage.seedSkill(skillSource);
        const driver = await editor.mount("skill");
        const codeMirror = createCodeMirrorDriver(driver.content);
        const source = skillSource.replace(
            "disable-model-invocation: false",
            "disable-model-invocation: "
        );
        await driver.content.fill(source);
        await expect.poll(() => codeMirror.text()).toBe(source);
        await codeMirror.placeCursor(
            source.indexOf("disable-model-invocation: ") + "disable-model-invocation: ".length
        );
        await userEvent.keyboard("{Control>}{Space}{/Control}");
        await expectCompletionOptions(codeMirror, ["true", "false"]);
        await codeMirror.completionOption("true").click();
        await expect.poll(() => codeMirror.text()).toContain("disable-model-invocation: true");
    });
});
