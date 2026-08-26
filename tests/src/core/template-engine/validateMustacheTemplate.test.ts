import {beforeEach, describe, expect, test, vi} from "vitest";
import {MustacheView, validateMustacheTemplate} from "../../../../src/core/template-engine";

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue([
        "globalAgentInstruction",
        "last sunday",
        "today"
    ]);
});

describe("validateMustacheTemplate", () => {
    test("accepts canonical variables, aliases, and case-only variants", async () => {
        expect(
            await validateMustacheTemplate(
                "<% globalAgentInstruction %> <% last sunday %> <% TODAY %>"
            )
        ).toEqual([]);
    });

    test("reports escaped, unescaped, dotted, and current-context unknown variables", async () => {
        const source = "<% unknown %> <%& object.value %> <% . %>";

        expect((await validateMustacheTemplate(source)).map((issue) => issue.variableName)).toEqual(
            ["unknown", "object.value", "."]
        );
    });

    test("ignores section names but validates variables nested within them", async () => {
        const issues = await validateMustacheTemplate(
            "<% #includeFile %>query.ds <% unknown %><% /includeFile %>"
        );

        expect(issues).toHaveLength(1);
        expect(issues[0].variableName).toBe("unknown");
    });

    test("reports malformed syntax without throwing", async () => {
        const issues = await validateMustacheTemplate("Text <% today");

        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain("Invalid Mustache syntax");
        expect(issues[0].from).toBe(5);
    });

    test("rejects delimiter changes and leaves Logseq macros literal", async () => {
        expect(await validateMustacheTemplate("{{unknown}}")).toEqual([]);
        expect((await validateMustacheTemplate("<%={{ }}=%>{{today}}"))[0].message).toContain(
            "Changing Mustache delimiters"
        );
    });

    test("validates variables in fenced code", async () => {
        const issues = await validateMustacheTemplate(`\`\`\`text
<% unknownCode %>
\`\`\``);

        expect(issues.map((issue) => issue.variableName)).toEqual(["unknownCode"]);
    });
});
