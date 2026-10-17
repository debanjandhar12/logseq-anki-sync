import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {
    ReadParsedSkillFileCommand,
    ReadSkillFileCommand,
    LogseqReversibleTransactionCommandSerializer as Serializer
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import * as skillTemplate from "../../../../src/core/skill-parser";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const source = `---
name: test-skill
description: Test skill
disable-model-invocation: true
custom-field: preserved
---
# Instructions
Keep <Markdown> & body text unchanged. <%value%>`;
const renderWithView = skillTemplate.renderSkillFileTemplate;
const roundTrip = (command: ReadParsedSkillFileCommand) =>
    Serializer.deserialize(JSON.parse(JSON.stringify(Serializer.serialize(command))));

describe("ReadParsedSkillFileCommand", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("read-parsed-skill-command-test");
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockImplementation((content) =>
            renderWithView(content, {value: "rendered"} as never)
        );
    });
    afterEach(() => vi.restoreAllMocks());

    test("returns the complete wrapper while preserving frontmatter and rendering the body", async () => {
        await SkillStore.saveSkillFile(source);
        const result = await new ReadParsedSkillFileCommand({skillName: "test-skill"}).execute();
        expect(skillTemplate.renderSkillFileTemplate).toHaveBeenCalledWith(source);
        expect(result).toEqual({
            exists: true,
            content: `<skill_content name="test-skill">
# Skill: test-skill

${source.replace("<%value%>", "rendered")}

Base directory for this skill: /home/user/skills/test-skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
</skill_files>
</skill_content>`
        });
    });

    test.each([
        0, 10, 11, 25
    ])("samples at most ten of %i resources in sorted order", async (count) => {
        const paths = Array.from(
            {length: count},
            (_, index) => `${String(index).padStart(2, "0")}.md`
        );
        await SkillStore.saveSkillFile(source, {
            references: {
                ...Object.fromEntries(
                    [...paths].reverse().map((path) => [path, "resource content"])
                ),
                "nested/SKILL.md": "excluded"
            },
            scripts: {"SKILL.md": "also excluded"}
        });
        const readResource = vi.spyOn(Storage, "getFileContent");
        const result = await new ReadParsedSkillFileCommand({skillName: "test-skill"}).execute();
        expect(result.exists).toBe(true);
        expect(result.content?.match(/<file>.*<\/file>/g) ?? []).toEqual(
            paths
                .slice(0, 10)
                .map((path) => `<file>/home/user/skills/test-skill/references/${path}</file>`)
        );
        expect(readResource).toHaveBeenCalledTimes(1);
        expect(readResource).toHaveBeenCalledWith("skills/test-skill", "SKILL.md");
    });

    test("escapes generated paths without escaping skill instructions", async () => {
        await SkillStore.saveSkillFile(source, {references: {"a&<>\"'.md": "resource"}});
        const result = await new ReadParsedSkillFileCommand({skillName: "test-skill"}).execute();
        expect(result.content).toContain(
            "<file>/home/user/skills/test-skill/references/a&amp;&lt;&gt;&quot;&apos;.md</file>"
        );
        expect(result.content).toContain("Keep <Markdown> & body text unchanged.");
    });

    test.each([
        undefined,
        "malformed",
        source.replace("name: test-skill", "name: other-skill")
    ])("treats missing or invalid instructions as absent (%s)", async (content) => {
        if (content !== undefined) await Storage.saveFile("skills/test-skill", "SKILL.md", content);
        const command = new ReadParsedSkillFileCommand({skillName: "test-skill"});
        expect(await command.execute()).toEqual({exists: false, content: null});
        expect(command.getCommandState()).toEqual({status: "executed"});
        expect(skillTemplate.renderSkillFileTemplate).not.toHaveBeenCalled();
        if (content !== undefined) {
            expect(await new ReadSkillFileCommand({skillName: "test-skill"}).execute()).toEqual({
                exists: true,
                content
            });
        }
    });

    test.each([
        "../test-skill",
        "folder/test-skill",
        "Test Skill",
        "test_skill",
        "test--skill",
        "a".repeat(65)
    ])("rejects invalid skill identity %j", (skillName) =>
        expect(() => new ReadParsedSkillFileCommand({skillName})).toThrow());

    test("is read-only and supports lifecycle guards and serialized state restoration", async () => {
        await SkillStore.saveSkillFile(source);
        const command = roundTrip(new ReadParsedSkillFileCommand({skillName: "test-skill"}));
        expect(command).toBeInstanceOf(ReadParsedSkillFileCommand);
        expect(command.args).toEqual({skillName: "test-skill"});
        expect(command.getCommandState()).toEqual({status: "new"});
        expect(command.doesGraphMutations()).toBe(false);
        await expect(command.revert()).rejects.toThrow("has not been executed");
        const result = await command.execute();
        expect(command.getChangedPages()).toEqual([]);
        expect(command.getChangedAssets()).toEqual([]);
        expect(Serializer.serialize(command)).toEqual({
            type: "ReadParsedSkillFile",
            args: {skillName: "test-skill"},
            commandState: {status: "executed"}
        });
        const restored = Serializer.deserialize(
            JSON.parse(JSON.stringify(Serializer.serialize(command)))
        );
        await expect(restored.execute()).rejects.toThrow("already been executed");
        await restored.revert();
        expect(restored.getCommandState()).toEqual({status: "new"});
        expect(await restored.execute()).toEqual(result);
        expect(await Storage.getFileContent("skills/test-skill", "SKILL.md")).toBe(source);
    });

    test.each([
        "getSkill",
        "listSkillFiles"
    ] as const)("propagates %s failures and allows retry", async (method) => {
        await SkillStore.saveSkillFile(source);
        const error = new Error("storage unavailable");
        vi.spyOn(SkillStore, method).mockRejectedValueOnce(error);
        const command = new ReadParsedSkillFileCommand({skillName: "test-skill"});
        await expect(command.execute()).rejects.toBe(error);
        expect(command.getCommandState()).toEqual({status: "new"});
        expect(await command.execute()).toMatchObject({exists: true});
    });

    test("propagates rendering failures and allows retry", async () => {
        await SkillStore.saveSkillFile(source);
        const error = new Error("Unclosed tag");
        vi.spyOn(skillTemplate, "renderSkillFileTemplate").mockRejectedValueOnce(error);
        const command = new ReadParsedSkillFileCommand({skillName: "test-skill"});
        await expect(command.execute()).rejects.toBe(error);
        expect(command.getCommandState()).toEqual({status: "new"});
        expect(await command.execute()).toMatchObject({exists: true});
    });
});
