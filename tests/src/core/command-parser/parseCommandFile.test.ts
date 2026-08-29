import {describe, expect, test} from "vitest";
import {parseCommandFile} from "../../../../src/core/command-parser";

describe("parseCommandFile", () => {
    test("returns a normalized command", () => {
        const content = `---
name: My command
invoke-condition:
  - Logseq Command Center
---
Prompt`;

        expect(parseCommandFile(content)).toEqual({
            name: "My command",
            invokeConditions: ["Logseq Command Center"],
            userInvocable: true,
            commandInvokeInNewThread: true,
            builtInCommand: undefined,
            builtInCommandUserControllable: undefined,
            content
        });
    });

    test("throws the first validation issue", () => {
        expect(() => parseCommandFile("Prompt")).toThrow(
            "Invalid command file structure: frontmatter is required"
        );
    });
});
