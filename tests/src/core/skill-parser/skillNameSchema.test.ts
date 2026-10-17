import {describe, expect, test} from "vitest";
import {skillNameSchema as barrelSchema} from "../../../../src/core/skill-parser";
import {
    skillNameSchema as compatibilitySchema,
    skillMetadataSchema
} from "../../../../src/core/skill-parser/skillMetadataSchema";
import {skillNameSchema} from "../../../../src/core/skill-parser/skillNameSchema";

describe("skillNameSchema", () => {
    test("exports the same schema through the old path and parser barrel", () => {
        expect(compatibilitySchema).toBe(skillNameSchema);
        expect(barrelSchema).toBe(skillNameSchema);
        expect(skillMetadataSchema.shape.name).toBe(skillNameSchema);
    });

    test.each(["a", "0", "my-skill-123", "a".repeat(64)])("accepts %s", (name) => {
        expect(skillNameSchema.parse(name)).toBe(name);
    });

    test.each([
        "",
        "a".repeat(65),
        "Uppercase",
        "two words",
        "repeated--hyphens",
        "-leading",
        "trailing-",
        "folder/skill",
        "folder\\skill",
        ".",
        "..",
        "../skill",
        " skill "
    ])("rejects %s", (name) => {
        expect(skillNameSchema.safeParse(name).success).toBe(false);
    });

    test("preserves the grammar diagnostic", () => {
        const result = skillNameSchema.safeParse("Uppercase");
        expect(result.error?.issues[0].message).toBe(
            "Skill name must contain lowercase letters, digits, and single separating hyphens"
        );
    });
});
