import {MustacheView} from "src/core/template-engine";
import {
    getFirstInvalidSkillTemplate,
    validateSkillFilesForSave
} from "src/ui/pages/SkillEditorModal";
import {beforeEach, describe, expect, test, vi} from "vitest";

function createSkillContent(overrides: {name?: string; description?: string; body?: string} = {}) {
    const {
        name = "My skill",
        description = "Does something useful",
        body = "# My skill"
    } = overrides;
    return `---
name: ${name}
description: ${description}
---

${body}
`;
}

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today", "currentPage"]);
});

describe("SkillEditorModal template validation", () => {
    test("returns the first invalid active or inactive skill", async () => {
        const result = await getFirstInvalidSkillTemplate([
            {id: "valid", content: "<% today %>"},
            {id: "built-in", content: "<% unknown %>"},
            {id: "later", content: "<% anotherUnknown %>"}
        ]);

        expect(result?.fileId).toBe("built-in");
        expect(result?.issue.message).toBe("Unknown Mustache variable: unknown");
    });

    test("accepts all valid templates", async () => {
        await expect(
            getFirstInvalidSkillTemplate([
                {id: "one", content: "<% today %>"},
                {id: "two", content: "<% currentPage %>"}
            ])
        ).resolves.toBeNull();
    });
});

describe("validateSkillFilesForSave", () => {
    test("reports the first invalid Mustache template", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "valid", content: createSkillContent()},
            {id: "broken", content: createSkillContent({body: "<% unknown %>"})}
        ]);

        expect(issue?.kind).toBe("invalid-template");
        expect(issue?.fileId).toBe("broken");
        expect(issue?.message).toBe("Unknown Mustache variable: unknown");
    });

    test("rejects Mustache templates in frontmatter", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "broken", content: createSkillContent({name: "<% today %>"})}
        ]);

        expect(issue).toMatchObject({
            kind: "invalid-template",
            fileId: "broken",
            message: "Mustache templates are not supported in skill file frontmatter."
        });
    });

    test("reports unparseable skill files", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "no-frontmatter", content: "# No frontmatter here"}
        ]);

        expect(issue?.kind).toBe("parse-error");
        expect(issue?.fileId).toBe("no-frontmatter");
    });

    test("reports malformed YAML as a parse error", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "bad-yaml", content: "---\nname: [\ndescription: Test\n---"}
        ]);

        expect(issue?.kind).toBe("parse-error");
        expect(issue?.message).toContain("Invalid skill file frontmatter");
    });

    test("reports Mustache errors before frontmatter errors", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "broken", content: "---\nname: 42\n---\n<% unknown %>"}
        ]);

        expect(issue?.kind).toBe("invalid-template");
    });

    test("accepts unknown frontmatter fields", async () => {
        const content = createSkillContent().replace(
            "---\n\n# My skill",
            "custom: value\n---\n\n# My skill"
        );
        const {issue} = await validateSkillFilesForSave([{id: "custom", content}]);

        expect(issue).toBeNull();
    });

    test("reports invalid file names", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "bad-name", content: createSkillContent({name: 'my/bad"name'})}
        ]);

        expect(issue?.kind).toBe("invalid-file-name");
        expect(issue?.fileId).toBe("bad-name");
    });

    test("reports duplicate skill names case-insensitively", async () => {
        const {issue} = await validateSkillFilesForSave([
            {id: "first", content: createSkillContent({name: "My Skill"})},
            {id: "second", content: createSkillContent({name: "my skill"})}
        ]);

        expect(issue?.kind).toBe("duplicate-name");
        expect(issue?.fileId).toBe("second");
    });

    test("returns parsed files in order when everything is valid", async () => {
        const firstContent = createSkillContent({name: "First"});
        const secondContent = createSkillContent({name: "Second"});

        const {issue, parsedFiles} = await validateSkillFilesForSave([
            {id: "first", content: firstContent},
            {id: "second", content: secondContent}
        ]);

        expect(issue).toBeNull();
        expect(parsedFiles.map((parsedFile) => parsedFile.name)).toEqual(["First", "Second"]);
        expect(parsedFiles.map((parsedFile) => parsedFile.content)).toEqual([
            firstContent,
            secondContent
        ]);
    });
});
