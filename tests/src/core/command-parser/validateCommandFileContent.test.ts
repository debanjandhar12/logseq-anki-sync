import {describe, expect, test} from "vitest";
import {validateCommandFileContent} from "../../../../src/core/command-parser";

function createCommandSource(metadata = "", body = "Prompt") {
    return `---\nname: Test command\ninvoke-location:\n  - Block Context Menu/Image\n${metadata}---\n${body}`;
}

describe("validateCommandFileContent", () => {
    test("parses all fields and preserves unknown metadata", () => {
        const content = createCommandSource(
            "user-invocable: false\ncommand-invoke-in-new-thread: false\ncommand-appear-seperately-in-context-menu: true\nbuilt-in-command: true\nbuilt-in-command-user-controllable: true\ncustom-field: accepted\n"
        );
        const result = validateCommandFileContent(content);

        expect(result).toEqual({
            valid: true,
            commandFile: {
                name: "Test command",
                invokeLocations: ["Block Context Menu/Image"],
                userInvocable: false,
                commandInvokeInNewThread: false,
                commandAppearSeparatelyInContextMenu: true,
                builtInCommand: true,
                builtInCommandUserControllable: true,
                content
            },
            issues: []
        });
    });

    test("applies optional invocation boolean defaults", () => {
        const result = validateCommandFileContent(createCommandSource());

        expect(result.valid).toBe(true);
        expect(result.commandFile).toMatchObject({
            userInvocable: true,
            commandInvokeInNewThread: true,
            commandAppearSeparatelyInContextMenu: false
        });
    });

    test.each([
        ["missing", "---\nname: Test\n---", "must be a non-empty array"],
        ["empty", "---\nname: Test\ninvoke-location: []\n---", "must contain at least one value"],
        [
            "scalar",
            "---\nname: Test\ninvoke-location: Block Slash Command\n---",
            "must be a non-empty array"
        ]
    ])("rejects a %s invoke-location", (_case, content, expectedMessage) => {
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(result.issues[0].message).toContain(expectedMessage);
    });

    test("reports unsupported and duplicate locations at their array items", () => {
        const content = `---
name: Test
invoke-location:
  - Unsupported Route
  - Block Slash Command
  - Block Slash Command
---`;
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(result.issues.map(({message}) => message)).toEqual([
            "Invalid command file metadata: unsupported invoke location: Unsupported Route",
            "Invalid command file metadata: duplicate invoke location: Block Slash Command"
        ]);
        expect(result.issues.map(({from, to}) => content.slice(from, to))).toEqual([
            "  - Unsupported Route",
            "  - Block Slash Command"
        ]);
        expect(result.issues[1].from).toBeGreaterThan(result.issues[0].from);
    });

    test("locates each repeated duplicate occurrence", () => {
        const content = `---
name: Test
invoke-location:
  - Block Slash Command
  - Block Slash Command
  - Block Slash Command
---`;
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(2);
        expect(result.issues[1].from).toBeGreaterThan(result.issues[0].from);
    });

    test("scopes CRLF item diagnostics to invoke-location", () => {
        const content = [
            "---",
            "other-values:",
            "  - Unsupported Route",
            "invoke-location:",
            "  - Unsupported Route",
            "  - Unsupported Route",
            "---"
        ].join("\r\n");
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(3);
        expect(result.issues.slice(1).map(({from, to}) => content.slice(from, to))).toEqual([
            "  - Unsupported Route",
            "  - Unsupported Route"
        ]);
        expect(result.issues[1].from).toBeGreaterThan(content.indexOf("invoke-location:"));
        expect(result.issues[2].from).toBeGreaterThan(result.issues[1].from);
    });

    test("locates items under the top-level invoke-location key", () => {
        const content = `---
nested:
  invoke-location:
    - Unsupported Route
name: Test
invoke-location:
  - Unsupported Route
---`;
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(content.slice(result.issues[0].from, result.issues[0].to)).toBe(
            "  - Unsupported Route"
        );
        expect(result.issues[0].from).toBeGreaterThan(content.lastIndexOf("invoke-location:"));
    });

    test("collects invalid name and boolean fields", () => {
        const content = `---
name: " "
invoke-location:
  - Block Slash Command
user-invocable: enabled
command-invoke-in-new-thread: new
command-appear-seperately-in-context-menu: separate
built-in-command: built-in
built-in-command-user-controllable: controllable
---`;
        const result = validateCommandFileContent(content);

        expect(result.valid).toBe(false);
        expect(result.issues.map(({message}) => message)).toEqual([
            "Invalid command file metadata: name is required",
            "Invalid command file metadata: user-invocable must be a boolean",
            "Invalid command file metadata: command-invoke-in-new-thread must be a boolean",
            "Invalid command file metadata: command-appear-seperately-in-context-menu must be a boolean",
            "Invalid command file metadata: built-in-command must be a boolean",
            "Invalid command file metadata: built-in-command-user-controllable must be a boolean"
        ]);
    });

    test("returns bounded diagnostics for missing frontmatter and malformed YAML", () => {
        for (const content of ["Prompt", "---\r\nname: [\r\ninvoke-location: []\r\n---"]) {
            const result = validateCommandFileContent(content);
            expect(result.valid).toBe(false);
            for (const issue of result.issues) {
                expect(issue.from).toBeGreaterThanOrEqual(0);
                expect(issue.to).toBeGreaterThanOrEqual(issue.from);
                expect(issue.to).toBeLessThanOrEqual(content.length);
            }
        }
    });
});
