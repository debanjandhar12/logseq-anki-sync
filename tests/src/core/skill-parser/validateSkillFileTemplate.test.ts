import {beforeEach, describe, expect, test, vi} from "vitest";
import {
    FRONTMATTER_MUSTACHE_MESSAGE,
    validateSkillFileTemplate
} from "../../../../src/core/skill-parser";
import {MustacheView} from "../../../../src/core/template-engine";

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});

describe("validateSkillFileTemplate", () => {
    test("rejects known and unknown Mustache tags in frontmatter", async () => {
        const source = "---\nname: <% today %>\ndescription: <% unknown %>\n---\n<% today %>";
        const issues = await validateSkillFileTemplate(source);

        expect(issues.map(({message}) => message)).toEqual([
            FRONTMATTER_MUSTACHE_MESSAGE,
            FRONTMATTER_MUSTACHE_MESSAGE
        ]);
        expect(source.slice(issues[0].from, issues[0].to)).toBe("<% today %>");
    });

    test("validates body variables at document-relative offsets", async () => {
        const source = "---\nname: Test\ndescription: Test\n---\n<% unknown %>";
        const issues = await validateSkillFileTemplate(source);

        expect(issues[0].variableName).toBe("unknown");
        expect(source.slice(issues[0].from, issues[0].to)).toContain("unknown");
    });

    test("treats suffix text after closing hyphens as body", async () => {
        await expect(
            validateSkillFileTemplate("---\nname: Test\ndescription: Test\n--- <% today %>")
        ).resolves.toEqual([]);
    });
});
