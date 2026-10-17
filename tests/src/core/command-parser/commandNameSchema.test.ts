import matter from "gray-matter";
import {describe, expect, test} from "vitest";
import {commandNameSchema, validateCommandFileContent} from "../../../../src/core/command-parser";

const source = (name: unknown) =>
    matter.stringify("Prompt", {
        name,
        "invoke-location": ["Logseq Command Center"]
    });

describe("command format names", () => {
    test.each([
        "My Command",
        "你好",
        "a--B",
        "../path",
        "folder\\name",
        "Command?",
        ".",
        "..",
        " padded ",
        "trailing."
    ])("accepts meaningful format name %s without filesystem policy", (name) => {
        expect(commandNameSchema.parse(name)).toBe(name);
        // The schema does not transform values; the existing frontmatter reader trims them.
        expect(validateCommandFileContent(source(name)).commandFile?.name).toBe(name.trim());
    });

    test.each(["", " ", "\t\n", null, 42, false])("rejects blank or nonstring name %j", (name) => {
        expect(commandNameSchema.safeParse(name).success).toBe(false);
        const content = source(name);
        const result = validateCommandFileContent(content);
        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(1);
        const issue = result.issues[0];
        expect(issue.message).toBe("Invalid command file metadata: name is required");
        expect(content.slice(issue.from, issue.to)).toMatch(/^name:/);
    });

    test("retains the missing-name diagnostic at the frontmatter delimiter", () => {
        expect(commandNameSchema.safeParse(undefined).success).toBe(false);
        const result = validateCommandFileContent(
            "---\ninvoke-location: [Logseq Command Center]\n---\nPrompt"
        );
        expect(result.issues).toEqual([
            {
                from: 0,
                to: 3,
                message: "Invalid command file metadata: name is required"
            }
        ]);
    });
});
