import {describe, expect, test} from "vitest";
import {parseSkillFile} from "../../../../../src/core/skill-parser";
import {createNewSkillContent} from "../../../../../src/ui/pages/SkillEditorModal/utils/createNewSkillContent";

describe("createNewSkillContent", () => {
    test("generates valid unused names, including original names reserved during a rename", () => {
        const first = createNewSkillContent([]);
        expect(parseSkillFile(first).name).toBe("new-skill");
        const second = createNewSkillContent([first]);
        expect(parseSkillFile(second).name).toBe("new-skill-2");
        expect(parseSkillFile(createNewSkillContent([second], ["new-skill"])).name).toBe(
            "new-skill-3"
        );
    });
});
