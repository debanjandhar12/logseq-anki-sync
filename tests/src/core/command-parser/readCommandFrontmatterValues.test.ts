import {describe, expect, test} from "vitest";
import {
    COMMAND_FRONTMATTER_FIELDS,
    COMMAND_FRONTMATTER_KEYS,
    COMMAND_INVOKE_CONDITIONS,
    readCommandFrontmatterValues
} from "../../../../src/core/command-parser";

describe("command frontmatter fields", () => {
    test("defines every metadata field once in canonical order", () => {
        expect(COMMAND_FRONTMATTER_FIELDS.map(({dataKey}) => dataKey)).toEqual([
            "name",
            "invokeConditions",
            "userInvocable",
            "commandInvokeInNewThread",
            "commandAppearSeparatelyInContextMenu",
            "builtInCommand",
            "builtInCommandUserControllable"
        ]);
        expect(new Set(COMMAND_INVOKE_CONDITIONS).size).toBe(11);
    });

    test("exposes YAML keys by data key", () => {
        expect(COMMAND_FRONTMATTER_KEYS).toEqual({
            name: "name",
            invokeConditions: "invoke-condition",
            userInvocable: "user-invocable",
            commandInvokeInNewThread: "command-invoke-in-new-thread",
            commandAppearSeparatelyInContextMenu: "command-appear-seperately-in-context-menu",
            builtInCommand: "built-in-command",
            builtInCommandUserControllable: "built-in-command-user-controllable"
        });
    });

    test("reads supported values permissively", () => {
        expect(
            readCommandFrontmatterValues({
                name: "  Test  ",
                "invoke-condition": ["Unsupported Route"],
                "user-invocable": false,
                "command-invoke-in-new-thread": "yes"
            })
        ).toEqual({
            name: "Test",
            userInvocable: false
        });
    });
});
