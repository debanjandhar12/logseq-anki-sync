import {describe, expect, test} from "vitest";
import {getFirstInvalidSkillTemplate} from "../../../../src/ui/pages/SkillEditorModal";

describe("SkillEditorModal template validation", () => {
    test("returns the first invalid active or inactive skill", () => {
        const result = getFirstInvalidSkillTemplate([
            {id: "valid", content: "<% today %>"},
            {id: "built-in", content: "<% unknown %>"},
            {id: "later", content: "<% anotherUnknown %>"}
        ]);

        expect(result?.fileId).toBe("built-in");
        expect(result?.issue.message).toBe("Unknown Mustache variable: unknown");
    });

    test("accepts all valid templates", () => {
        expect(
            getFirstInvalidSkillTemplate([
                {id: "one", content: "<% today %>"},
                {id: "two", content: "<% current page %>"}
            ])
        ).toBeNull();
    });
});
