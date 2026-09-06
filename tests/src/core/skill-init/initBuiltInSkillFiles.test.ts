import {beforeEach, describe, expect, test} from "vitest";
import {initBuiltInSkillFiles} from "../../../../src/core/skill-init/initBuiltInSkillFiles";
import {SkillFileStore} from "../../../../src/core/stores/skill-file-store/SkillFileStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

describe("initBuiltInSkillFiles", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("built-in-skill-test");
    });

    test("does not overwrite a malformed same-name file", async () => {
        const fileName = "Skill Creator.md";
        await LogseqPluginStorageManager.saveFile(
            SkillFileStore.groupName,
            fileName,
            "malformed user content"
        );

        await initBuiltInSkillFiles();

        await expect(
            LogseqPluginStorageManager.getFileContent(SkillFileStore.groupName, fileName)
        ).resolves.toBe("malformed user content");
    });

    test("reports whether a skill file exists", async () => {
        await expect(SkillFileStore.skillFileExists("Missing.md")).resolves.toBe(false);
        await LogseqPluginStorageManager.saveFile(
            SkillFileStore.groupName,
            "Present.md",
            "content"
        );
        await expect(SkillFileStore.skillFileExists("Present.md")).resolves.toBe(true);
    });

    test("installs the Working with Bash skill", async () => {
        await initBuiltInSkillFiles();

        const skill = await SkillFileStore.getSkillFile("Working with Bash.md");

        expect(skill).toEqual(
            expect.objectContaining({
                name: "Working with Bash",
                builtInSkill: true,
                disableModelInvocation: false
            })
        );
        expect(skill?.content).toContain("micropip");
        expect(skill?.content).toContain("scipy==1.18.0");
        expect(skill?.content).toContain("youtube-transcript-api==1.2.4");
        expect(skill?.content).not.toContain("qjs");
    });
});
