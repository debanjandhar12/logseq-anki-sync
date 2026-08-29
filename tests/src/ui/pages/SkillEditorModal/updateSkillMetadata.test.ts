import matter from "gray-matter";
import {
    updateDisableModelInvocation,
    updateSkillMetadata
} from "src/ui/pages/SkillEditorModal/utils/updateSkillMetadata";
import {describe, expect, test} from "vitest";

describe("skill metadata updates", () => {
    test("updates model invocation while preserving body and unrelated metadata", () => {
        const source = `---
name: Test skill
description: Test description
disable-model-invocation: false
custom-field: retained
---

Skill body
`;
        const updated = matter(updateDisableModelInvocation(source, true));

        expect(updated.data).toMatchObject({
            name: "Test skill",
            description: "Test description",
            "disable-model-invocation": true,
            "custom-field": "retained"
        });
        expect(updated.content).toBe("\nSkill body\n");
    });

    test("adds frontmatter to content that has none", () => {
        const updated = matter(updateDisableModelInvocation("Skill body", false));

        expect(updated.data["disable-model-invocation"]).toBe(false);
        expect(updated.content).toBe("Skill body\n");
    });

    test("supports structural updates through the shared helper", () => {
        const updated = matter(updateSkillMetadata("Skill body", {name: "Updated skill"}));

        expect(updated.data.name).toBe("Updated skill");
        expect(updated.content).toBe("Skill body\n");
    });
});
