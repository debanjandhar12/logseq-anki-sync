import {describe, expect, test} from "vitest";
import {
    readSkillFrontmatterValues,
    SKILL_FRONTMATTER_FIELDS,
    SKILL_FRONTMATTER_KEYS
} from "../../../../src/core/skill-parser/skillFrontmatterFields";

describe("skill frontmatter fields", () => {
    test("defines every metadata field once in canonical order", () => {
        expect(SKILL_FRONTMATTER_FIELDS.map(({dataKey}) => dataKey)).toEqual([
            "name",
            "description",
            "disableModelInvocation",
            "builtInSkill",
            "builtInSkillUserControllable"
        ]);
        expect(new Set(SKILL_FRONTMATTER_FIELDS.map(({dataKey}) => dataKey)).size).toBe(5);
    });

    test("exposes YAML keys by data key", () => {
        expect(SKILL_FRONTMATTER_KEYS).toEqual({
            name: "name",
            description: "description",
            disableModelInvocation: "disable-model-invocation",
            builtInSkill: "built-in-skill",
            builtInSkillUserControllable: "built-in-skill-user-controllable"
        });
    });

    test("reads supported values permissively", () => {
        expect(
            readSkillFrontmatterValues({
                name: "  Test  ",
                description: 42,
                "disable-model-invocation": false,
                "built-in-skill": "enabled"
            })
        ).toEqual({name: "Test", disableModelInvocation: false});
    });
});
