import {afterEach, describe, expect, test, vi} from "vitest";
import {SkillTool} from "../../../../../src/chat-app/tools/impl/SkillTool";
import * as skillTemplate from "../../../../../src/core/skill-parser";
import {SkillStore} from "../../../../../src/core/stores/skill-store/SkillStore";

describe("SkillTool", () => {
    afterEach(() => vi.restoreAllMocks());

    test("renders the stored skill before returning it", async () => {
        const source = `---
name: test-skill
description: Test skill
---

# <% currentPage %>`;
        vi.spyOn(SkillStore, "getSkill").mockResolvedValue({
            name: "test-skill",
            folderName: "test-skill",
            description: "Test skill",
            content: source
        });
        const render = vi
            .spyOn(skillTemplate, "renderSkillFileTemplate")
            .mockResolvedValue("rendered skill source");

        const response = await new SkillTool().execute({fileName: "test-skill"});

        expect(SkillStore.getSkill).toHaveBeenCalledWith("test-skill");
        expect(render).toHaveBeenCalledWith(source);
        expect(response.result).toEqual({
            success: true,
            skillFileContent: "rendered skill source"
        });
    });

    test("returns the existing not-found result", async () => {
        vi.spyOn(SkillStore, "getSkill").mockResolvedValue(null);
        const render = vi.spyOn(skillTemplate, "renderSkillFileTemplate");

        const response = await new SkillTool().execute({fileName: "missing"});

        expect(render).not.toHaveBeenCalled();
        expect(response.result).toEqual({
            success: false,
            error: "Skill file not found: missing"
        });
    });

    test("returns an error when rendering fails", async () => {
        vi.spyOn(SkillStore, "getSkill").mockResolvedValue({
            name: "test-skill",
            folderName: "test-skill",
            description: "Test skill",
            content: "<% invalid"
        });
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockRejectedValue(
            new Error("Unclosed tag")
        );

        const response = await new SkillTool().execute({fileName: "test-skill"});

        expect(response.result).toEqual({
            success: false,
            error: "Failed to read skill file test-skill: Unclosed tag"
        });
    });
});
