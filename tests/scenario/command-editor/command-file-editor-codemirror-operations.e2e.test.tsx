import {startCompletion} from "@codemirror/autocomplete";
import {describe, expect} from "vitest";
import {userEvent} from "vitest/browser";
import {
    expectCompletionOptions,
    expectFrontmatterCompletionSuppressed
} from "../../helpers/skill-and-command-editor/assertions";
import {createCodeMirrorDriver} from "../../helpers/skill-and-command-editor/createCodeMirrorDriver";
import {test} from "../../helpers/skill-and-command-editor/fixtures";

const commandSource = `---
name: Example command
invoke-location:
  - Block Slash Command
user-invocable: true
---

# Primary heading

## Secondary heading

Instructions.
`;

describe("Command file editor CodeMirror operations", () => {
    for (const controllable of [false, true]) {
        test(`built-in content is read-only (user-controllable: ${controllable})`, async ({
            storage,
            editor
        }) => {
            const source = commandSource.replace(
                "user-invocable: true",
                `user-invocable: true\nbuilt-in-command: true\nbuilt-in-command-user-controllable: ${controllable}`
            );
            await storage.seedCommand(source);
            const driver = await editor.mount("command");
            const codeMirror = createCodeMirrorDriver(driver.content);
            await expect.element(driver.content).toHaveAttribute("contenteditable", "false");
            await driver.content.click();
            await userEvent.keyboard("Attempted edit");
            expect(codeMirror.text()).toBe(source);
            expect((await storage.getCommand("Example command"))?.content).toBe(source);
        });
    }

    test("typing <% in the body suggests variables and inserts the selected variable", async ({
        storage,
        editor
    }) => {
        await storage.seedCommand(commandSource);
        const driver = await editor.mount("command");
        const codeMirror = createCodeMirrorDriver(driver.content);
        await codeMirror.placeCursor(commandSource.length);
        await userEvent.keyboard("<%");
        await expectCompletionOptions(codeMirror, ["<% today %>", "<% tomorrow %>"]);
        await codeMirror.completionOption("<% today %>").click();
        await expect.poll(() => codeMirror.text()).toBe(`${commandSource}<% today %>`);
    });

    test("template variable completion is suppressed in frontmatter", async ({storage, editor}) => {
        await storage.seedCommand(commandSource);
        const driver = await editor.mount("command");
        const codeMirror = createCodeMirrorDriver(driver.content);
        await codeMirror.placeCursor(commandSource.length);
        await userEvent.keyboard("<%");
        await expectCompletionOptions(codeMirror, ["<% today %>"]);
        await userEvent.keyboard("{Escape}");
        const position = commandSource.indexOf("name: ") + "name: ".length;
        await codeMirror.placeCursor(position);
        await userEvent.keyboard("<%");
        startCompletion(codeMirror.view());
        await expectFrontmatterCompletionSuppressed(codeMirror, position);
    });

    test("Markdown headers are bold and underlined", async ({storage, editor}) => {
        await storage.seedCommand(commandSource);
        const driver = await editor.mount("command");
        for (const name of ["Primary heading", "Secondary heading"]) {
            const heading = driver.content.getByText(new RegExp(`^#+ ${name}$`));
            await expect.element(heading).toBeVisible();
            expect(Number(getComputedStyle(heading.element()).fontWeight)).toBeGreaterThanOrEqual(
                600
            );
            expect(getComputedStyle(heading.element()).textDecorationLine).toContain("underline");
        }
    });

    test("user-invocable offers true and false completions", async ({storage, editor}) => {
        await storage.seedCommand(commandSource);
        const driver = await editor.mount("command");
        const codeMirror = createCodeMirrorDriver(driver.content);
        const source = commandSource.replace("user-invocable: true", "user-invocable: ");
        await driver.content.fill(source);
        await expect.poll(() => codeMirror.text()).toBe(source);
        await codeMirror.placeCursor(
            source.indexOf("user-invocable: ") + "user-invocable: ".length
        );
        await userEvent.keyboard("{Control>}{Space}{/Control}");
        await expectCompletionOptions(codeMirror, ["true", "false"]);
        await codeMirror.completionOption("false").click();
        await expect.poll(() => codeMirror.text()).toContain("user-invocable: false");
    });
});
