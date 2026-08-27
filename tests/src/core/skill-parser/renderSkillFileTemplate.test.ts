import {describe, expect, test} from "vitest";
import {renderSkillFileTemplate} from "../../../../src/core/skill-parser";

describe("renderSkillFileTemplate", () => {
    test.each([
        [
            "---\nname: <% today %>\ndescription: Test\n---\n<% today %>",
            "---\nname: <% today %>\ndescription: Test\n---\nrendered"
        ],
        [
            "---\r\nname: Test\r\ndescription: Test\r\n---\r\n<% today %>",
            "---\r\nname: Test\r\ndescription: Test\r\n---\r\nrendered"
        ],
        [
            "---\nname: Test\ndescription: Test\n---Body <% today %>",
            "---\nname: Test\ndescription: Test\n---Body rendered"
        ]
    ])("preserves frontmatter while rendering the body", async (source, expected) => {
        await expect(renderSkillFileTemplate(source, {today: "rendered"} as never)).resolves.toBe(
            expected
        );
    });
});
