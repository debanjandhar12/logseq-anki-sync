import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {SkillTool} from "../../../../../src/chat-app/tools/impl/SkillTool";
import {JustBashWrapper} from "../../../../../src/core/just-bash-wrapper";
import * as skillTemplate from "../../../../../src/core/skill-parser";
import {SkillStore} from "../../../../../src/core/stores/skill-store/SkillStore";
import {LogseqPluginStorageManager as Storage} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const source = `---
name: test-skill
description: Test skill
disable-model-invocation: true
custom-field: preserved
---

# Instructions
Keep <Markdown> & body text unchanged.`;
const renderWithView = skillTemplate.renderSkillFileTemplate;

describe("SkillTool", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("skill-tool-test");
        JustBashWrapper.resetInstanceForTesting();
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockImplementation((content) =>
            renderWithView(content, {} as never)
        );
    });
    afterEach(() => vi.restoreAllMocks());

    test("renders the stored skill and returns the exact wrapper with an empty file list", async () => {
        await SkillStore.saveSkillFile(source);
        const read = vi.spyOn(SkillStore, "getSkill");
        const render = vi
            .spyOn(skillTemplate, "renderSkillFileTemplate")
            .mockResolvedValue("rendered skill source");
        const response = await new SkillTool().execute({name: "test-skill"});
        expect(read).toHaveBeenCalledWith("test-skill");
        expect(render).toHaveBeenCalledWith(source);
        expect(response.result).toEqual({
            success: true,
            skillFileContent: `<skill_content name="test-skill">
# Skill: test-skill

rendered skill source

Base directory for this skill: /home/user/skills/test-skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
</skill_files>
</skill_content>`
        });
    });

    test("requires a compliant name and rejects the old fileName argument", () => {
        const parameters = new SkillTool().parameters;
        expect(parameters.safeParse({name: "test-skill"}).success).toBe(true);
        for (const name of ["Test Skill", "test_skill", " test", "test--skill", "a".repeat(65)]) {
            expect(parameters.safeParse({name}).success).toBe(false);
        }
        expect(parameters.safeParse({fileName: "test-skill"}).success).toBe(false);
    });

    test.each([
        0, 10, 11, 25
    ])("samples at most ten of %i resources deterministically", async (count) => {
        const references = Object.fromEntries(
            Array.from({length: count}, (_, index) => [
                `nested/${String(index).padStart(2, "0")}.md`,
                `resource content ${index}`
            ]).reverse()
        );
        await SkillStore.saveSkillFile(source, {
            references: {...references, "nested/SKILL.md": "not listed"},
            scripts: {"SKILL.md": "also not listed"}
        });
        const response = await new SkillTool().execute({name: "test-skill"});
        expect(response.result.success).toBe(true);
        if (!response.result.success) throw new Error("Skill load failed");
        const content = response.result.skillFileContent;
        expect(content.match(/<file>.*<\/file>/g) ?? []).toEqual(
            Object.keys(references)
                .sort()
                .slice(0, 10)
                .map((file) => `<file>/home/user/skills/test-skill/references/${file}</file>`)
        );
        expect(content).not.toContain("resource content");
        expect(content).not.toContain("/SKILL.md</file>");
        expect(content).toContain("disable-model-invocation: true");
        expect(content).toContain("custom-field: preserved");
        expect(content).toContain("Keep <Markdown> & body text unchanged.");
    });

    test("escapes XML metacharacters in generated paths", async () => {
        await SkillStore.saveSkillFile(source, {references: {"nested/a&<>\"'.md": "resource"}});
        const response = await new SkillTool().execute({name: "test-skill"});
        expect(response.result).toMatchObject({
            success: true,
            skillFileContent: expect.stringContaining(
                "<file>/home/user/skills/test-skill/references/nested/a&amp;&lt;&gt;&quot;&apos;.md</file>"
            )
        });
    });

    test("advertised reference paths are readable through the actual Bash mount", async () => {
        await JustBashWrapper.getInstance();
        await SkillStore.saveSkillFile(source, {references: {"nested/example.ds": "[:find ?b]"}});
        const response = await new SkillTool().execute({name: "test-skill"});
        expect(response.result.success).toBe(true);
        if (!response.result.success) throw new Error("Skill load failed");
        const referencePath = /<file>(.*?)<\/file>/.exec(response.result.skillFileContent)?.[1];
        expect(referencePath).toBe("/home/user/skills/test-skill/references/nested/example.ds");
        const bash = await JustBashWrapper.getInstance();
        expect(await bash.exec(`cat '${referencePath}'`)).toMatchObject({
            exitCode: 0,
            stdout: "[:find ?b]"
        });
    });

    test.each([
        undefined,
        "invalid content"
    ])("missing or invalid instructions use the not-found envelope (%s)", async (content) => {
        if (content !== undefined) await Storage.saveFile("skills/test-skill", "SKILL.md", content);
        const render = vi.spyOn(skillTemplate, "renderSkillFileTemplate");
        expect((await new SkillTool().execute({name: "test-skill"})).result).toEqual({
            success: false,
            error: "Skill file not found: test-skill"
        });
        expect(render).not.toHaveBeenCalled();
    });

    test.each([
        "getSkill",
        "listSkillFiles"
    ] as const)("reports %s storage failures", async (method) => {
        await SkillStore.saveSkillFile(source);
        vi.spyOn(SkillStore, method).mockRejectedValue(new Error("storage unavailable"));
        expect((await new SkillTool().execute({name: "test-skill"})).result).toEqual({
            success: false,
            error: "Failed to read skill file test-skill: storage unavailable"
        });
    });

    test("returns an error when rendering fails", async () => {
        await SkillStore.saveSkillFile(source);
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockRejectedValue(
            new Error("Unclosed tag")
        );
        expect((await new SkillTool().execute({name: "test-skill"})).result).toEqual({
            success: false,
            error: "Failed to read skill file test-skill: Unclosed tag"
        });
    });
});
