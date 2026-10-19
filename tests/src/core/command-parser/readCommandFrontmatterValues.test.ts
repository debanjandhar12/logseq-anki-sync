import {describe, expect, test} from "vitest";
import {
    COMMAND_FRONTMATTER_FIELDS,
    COMMAND_FRONTMATTER_KEYS,
    COMMAND_INVOKE_LOCATIONS,
    readCommandFrontmatterValues
} from "../../../../src/core/command-parser";

describe("command frontmatter fields", () => {
    test("defines every metadata field once in canonical order", () => {
        expect(COMMAND_FRONTMATTER_FIELDS.map(({dataKey}) => dataKey)).toEqual([
            "name",
            "invokeLocations",
            "userInvocable",
            "commandInvokeInNewThread",
            "commandAutoSend",
            "commandAppearSeparatelyInContextMenu",
            "builtInCommand",
            "builtInCommandUserControllable"
        ]);
        expect(new Set(COMMAND_INVOKE_LOCATIONS).size).toBe(11);
    });

    test("exposes YAML keys by data key", () => {
        expect(COMMAND_FRONTMATTER_KEYS).toEqual({
            name: "name",
            invokeLocations: "invoke-location",
            userInvocable: "user-invocable",
            commandInvokeInNewThread: "command-invoke-in-new-thread",
            commandAutoSend: "command-auto-send",
            commandAppearSeparatelyInContextMenu: "command-appear-separately-in-context-menu",
            builtInCommand: "built-in-command",
            builtInCommandUserControllable: "built-in-command-user-controllable"
        });
    });

    test("reads supported values permissively", () => {
        expect(
            readCommandFrontmatterValues({
                name: "  Test  ",
                "invoke-location": ["Unsupported Route"],
                "user-invocable": false,
                "command-invoke-in-new-thread": "yes"
            })
        ).toEqual({
            name: "Test",
            userInvocable: false
        });
    });

    test.each([true, false])("reads command-auto-send: %s without applying defaults", (value) => {
        expect(readCommandFrontmatterValues({"command-auto-send": value})).toEqual({
            commandAutoSend: value
        });
        expect(readCommandFrontmatterValues({"command-auto-send": String(value)})).toEqual({});
        expect(readCommandFrontmatterValues({})).toEqual({});
    });
});
