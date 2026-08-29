import {beforeEach, describe, expect, test, vi} from "vitest";
import {
    COMMAND_FRONTMATTER_MUSTACHE_MESSAGE,
    validateCommandFileTemplate
} from "../../../../src/core/command-parser";
import {MustacheView} from "../../../../src/core/template-engine";

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});

describe("validateCommandFileTemplate", () => {
    test("rejects Mustache in frontmatter", async () => {
        const source = `---
name: <% today %>
invoke-condition:
  - Block Slash Command
---
<% today %>`;
        const issues = await validateCommandFileTemplate(source);

        expect(issues).toHaveLength(1);
        expect(issues[0].message).toBe(COMMAND_FRONTMATTER_MUSTACHE_MESSAGE);
        expect(source.slice(issues[0].from, issues[0].to)).toBe("<% today %>");
    });

    test("reports unknown body variables at document-relative offsets", async () => {
        const source = `---
name: Test
invoke-condition:
  - Block Slash Command
---
<% unknown %>`;
        const issues = await validateCommandFileTemplate(source);

        expect(issues[0].variableName).toBe("unknown");
        expect(source.slice(issues[0].from, issues[0].to)).toContain("unknown");
    });
});
