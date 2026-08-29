import {beforeEach, describe, expect, test, vi} from "vitest";
import {MustacheView, validateFrontmatterTemplate} from "../../../../../src/core/template-engine";

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});

describe("validateFrontmatterTemplate", () => {
    test("rejects every Mustache tag in frontmatter with a generic diagnostic", async () => {
        const source = "---\nname: <% today %>\ndescription: <% unknown %>\n---\n<% today %>";
        const issues = await validateFrontmatterTemplate(source);

        expect(issues.map(({message}) => message)).toEqual([
            "Mustache templates are not supported in frontmatter.",
            "Mustache templates are not supported in frontmatter."
        ]);
        expect(source.slice(issues[0].from, issues[0].to)).toBe("<% today %>");
        expect(source.slice(issues[1].from, issues[1].to)).toBe("<% unknown %>");
    });

    test("validates body variables at document-relative offsets", async () => {
        const source = "---\nname: Test\n---\n<% unknown %>";
        const issues = await validateFrontmatterTemplate(source);

        expect(issues[0].variableName).toBe("unknown");
        expect(source.slice(issues[0].from, issues[0].to)).toContain("unknown");
    });

    test("validates a document without frontmatter", async () => {
        await expect(validateFrontmatterTemplate("<% today %>")).resolves.toEqual([]);
    });

    test("treats suffix text after closing hyphens as body", async () => {
        await expect(
            validateFrontmatterTemplate("---\nname: Test\n--- <% today %>")
        ).resolves.toEqual([]);
    });
});
