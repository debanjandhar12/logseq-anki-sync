import {describe, expect, test} from "vitest";
import {validateMustacheTemplate} from "../../../../src/core/template-engine";

describe("validateMustacheTemplate", () => {
    test("accepts canonical variables, aliases, and case-only variants", () => {
        expect(
            validateMustacheTemplate("<% globalAgentInstruction %> <% last sunday %> <% TODAY %>")
        ).toEqual([]);
    });

    test("reports escaped, unescaped, dotted, and current-context unknown variables", () => {
        const source = "<% unknown %> <%& object.value %> <% . %>";

        expect(validateMustacheTemplate(source).map((issue) => issue.variableName)).toEqual([
            "unknown",
            "object.value",
            "."
        ]);
    });

    test("ignores section names but validates variables nested within them", () => {
        const issues = validateMustacheTemplate(
            "<% #includeFile %>query.ds <% unknown %><% /includeFile %>"
        );

        expect(issues).toHaveLength(1);
        expect(issues[0].variableName).toBe("unknown");
    });

    test("reports malformed syntax without throwing", () => {
        const issues = validateMustacheTemplate("Text <% today");

        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain("Invalid Mustache syntax");
        expect(issues[0].from).toBe(5);
    });

    test("rejects delimiter changes and leaves Logseq macros literal", () => {
        expect(validateMustacheTemplate("{{unknown}}")).toEqual([]);
        expect(validateMustacheTemplate("<%={{ }}=%>{{today}}")[0].message).toContain(
            "Changing Mustache delimiters"
        );
    });

    test("validates variables in frontmatter and fenced code", () => {
        const issues = validateMustacheTemplate(`---
name: <% unknownFrontmatter %>
---

\`\`\`text
<% unknownCode %>
\`\`\``);

        expect(issues.map((issue) => issue.variableName)).toEqual([
            "unknownFrontmatter",
            "unknownCode"
        ]);
    });
});
