import {beforeEach, describe, expect, test} from "vitest";
import {initBuiltInSkillFiles} from "../../../../src/core/skills/initBuiltInSkillFiles";
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
});
