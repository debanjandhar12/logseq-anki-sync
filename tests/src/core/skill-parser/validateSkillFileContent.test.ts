import {describe, expect, test} from "vitest";
import {validateSkillFileContent} from "../../../../src/core/skill-parser/validateSkillFileContent";

function expectBoundedIssues(content: string) {
    const result = validateSkillFileContent(content);
    expect(result.valid).toBe(false);
    for (const issue of result.issues) {
        expect(issue.from).toBeGreaterThanOrEqual(0);
        expect(issue.to).toBeGreaterThanOrEqual(issue.from);
        expect(issue.to).toBeLessThanOrEqual(content.length);
    }
    return result.issues;
}

describe("validateSkillFileContent", () => {
    test("accepts valid LF and CRLF frontmatter with unknown fields", () => {
        for (const newline of ["\n", "\r\n"]) {
            const content = [
                "---",
                "name: Test skill",
                "description: Test description",
                "custom-field: accepted",
                "---",
                "# Body"
            ].join(newline);
            const result = validateSkillFileContent(content);

            expect(result.valid).toBe(true);
            expect(result.skillFile?.name).toBe("Test skill");
        }
    });

    test("marks the first line when frontmatter is missing", () => {
        expect(expectBoundedIssues("# Body")[0]).toMatchObject({
            from: 0,
            to: 6,
            message: "Invalid skill file structure: frontmatter is required"
        });
        expect(expectBoundedIssues("")[0]).toMatchObject({from: 0, to: 0});
    });

    test("marks malformed YAML consistently for LF and CRLF", () => {
        for (const newline of ["\n", "\r\n"]) {
            const content = ["---", "name: [", "description: Test", "---"].join(newline);
            const issue = expectBoundedIssues(content)[0];

            expect(issue.message).toContain("Invalid skill file frontmatter");
            expect(content.slice(issue.from, issue.to)).toBe("---");
        }
    });

    test("marks duplicate keys and does not cache failed parses", () => {
        const malformed = "---\nname: [\ndescription: Test\n---";
        const duplicate = "---\nname: First\nname: Second\ndescription: Test\n---";

        expect(expectBoundedIssues(malformed)[0].message).toContain(
            "Invalid skill file frontmatter"
        );
        expect(expectBoundedIssues(malformed)[0].message).toContain(
            "Invalid skill file frontmatter"
        );
        const duplicateIssue = expectBoundedIssues(duplicate)[0];
        expect(duplicateIssue.message).toContain("duplicated mapping key");
        expect(duplicate.slice(duplicateIssue.from, duplicateIssue.to)).toBe("name: Second");
    });

    test("collects metadata issues and marks present invalid fields", () => {
        const content = `---
name: 42
built-in-skill: enabled
disable-model-invocation: disabled
---`;
        const issues = expectBoundedIssues(content);

        expect(issues.map(({message}) => message)).toEqual([
            "Invalid skill file metadata: name is required",
            "Invalid skill file metadata: description is required",
            "Invalid skill file metadata: disable-model-invocation must be a boolean",
            "Invalid skill file metadata: built-in-skill must be a boolean"
        ]);
        expect(content.slice(issues[0].from, issues[0].to)).toBe("name: 42");
        expect(content.slice(issues[1].from, issues[1].to)).toBe("---");
        expect(content.slice(issues[2].from, issues[2].to)).toBe(
            "disable-model-invocation: disabled"
        );
    });

    test("supports quoted known keys and CRLF offsets", () => {
        const content =
            '---\r\n"name": Test\r\ndescription: Test\r\n"built-in-skill-user-controllable": enabled\r\n---';
        const issue = expectBoundedIssues(content)[0];

        expect(content.slice(issue.from, issue.to)).toBe(
            '"built-in-skill-user-controllable": enabled'
        );
    });

    test("marks consistently indented invalid fields", () => {
        const content =
            "---\r\n  nested:\r\n    name: nested\r\n  name: 42\r\n  description: Test\r\n---";
        const issue = expectBoundedIssues(content)[0];

        expect(content.slice(issue.from, issue.to)).toBe("  name: 42");
    });

    test("preserves gray-matter behavior for an unclosed parseable block", () => {
        const result = validateSkillFileContent("---\nname: Test\ndescription: Description");

        expect(result.valid).toBe(true);
    });
});
