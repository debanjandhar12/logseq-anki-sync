import {afterEach, expect, test, vi} from "vitest";
import {SkillStore} from "../../../../../src/core/stores/skill-store/SkillStore";
import {getModelInvokableSkillListString} from "../../../../../src/core/template-engine/renderer/getModelInvokableSkillListString";

afterEach(() => vi.restoreAllMocks());

test("advertises folder identities without .md and filters disabled skills", async () => {
    vi.spyOn(SkillStore, "getAllSkills").mockResolvedValue([
        {
            name: "enabled",
            folderName: "enabled",
            description: "Enabled instructions",
            content: "",
            disableModelInvocation: false
        },
        {name: "default", folderName: "default", description: "Default instructions", content: ""},
        {
            name: "disabled",
            folderName: "disabled",
            description: "Hidden",
            content: "",
            disableModelInvocation: true
        }
    ]);
    expect(await getModelInvokableSkillListString()).toBe(
        "* enabled - Enabled instructions\n* default - Default instructions"
    );
});
