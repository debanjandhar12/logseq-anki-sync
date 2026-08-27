import {afterEach, describe, expect, test, vi} from "vitest";
import {SkillTool} from "../../../../../src/chat-app/tools/impl/SkillTool";
import * as skillTemplate from "../../../../../src/core/skill-parser";
import {SkillFileStore} from "../../../../../src/core/stores/skill-file-store/SkillFileStore";

describe("SkillTool", () => {
    afterEach(() => vi.restoreAllMocks());

    test("renders the stored skill before returning it", async () => {
        const source = `---
name: <% today %>
description: Test skill
---

# <% currentPage %>`;
        vi.spyOn(SkillFileStore, "getSkillFile").mockResolvedValue({
            name: "Test skill",
            description: "Test skill",
            content: source
        });
        const render = vi
            .spyOn(skillTemplate, "renderSkillFileTemplate")
            .mockResolvedValue("rendered skill source");

        const response = await new SkillTool().execute({fileName: "Test skill.md"});

        expect(SkillFileStore.getSkillFile).toHaveBeenCalledWith("Test skill.md");
        expect(render).toHaveBeenCalledWith(source);
        expect(response.result).toEqual({
            success: true,
            skillFileContent: "rendered skill source"
        });
    });

    test("returns the existing not-found result", async () => {
        vi.spyOn(SkillFileStore, "getSkillFile").mockResolvedValue(null);
        const render = vi.spyOn(skillTemplate, "renderSkillFileTemplate");

        const response = await new SkillTool().execute({fileName: "Missing.md"});

        expect(render).not.toHaveBeenCalled();
        expect(response.result).toEqual({
            success: false,
            error: "Skill file not found: Missing.md"
        });
    });

    test("returns an error when rendering fails", async () => {
        vi.spyOn(SkillFileStore, "getSkillFile").mockResolvedValue({
            name: "Test skill",
            description: "Test skill",
            content: "<% invalid"
        });
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockRejectedValue(
            new Error("Unclosed tag")
        );

        const response = await new SkillTool().execute({fileName: "Test skill.md"});

        expect(response.result).toEqual({
            success: false,
            error: "Failed to read skill file Test skill.md: Unclosed tag"
        });
    });
});
