import {beforeEach, describe, expect, test} from "vitest";
import {SkillFileStore} from "../../../../src/core/stores/skill-file-store/SkillFileStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

function createSkillSource(name: string, builtInSkill = false) {
    return `---\nname: ${name}\ndescription: Test description\nbuilt-in-skill: ${builtInSkill}\n---\nPrompt`;
}

describe("SkillFileStore", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("skill-store-test");
    });

    test("sorts built-in skills before user skills and alphabetically within each group", async () => {
        await SkillFileStore.saveSkillFile(createSkillSource("Bravo"));
        await SkillFileStore.saveSkillFile(createSkillSource("Zulu", true));
        await SkillFileStore.saveSkillFile(createSkillSource("Alpha"));
        await SkillFileStore.saveSkillFile(createSkillSource("Yankee", true));

        await expect(SkillFileStore.getAllSkillFile()).resolves.toEqual([
            expect.objectContaining({name: "Yankee", builtInSkill: true}),
            expect.objectContaining({name: "Zulu", builtInSkill: true}),
            expect.objectContaining({name: "Alpha", builtInSkill: false}),
            expect.objectContaining({name: "Bravo", builtInSkill: false})
        ]);
    });

    test("ignores folder-based skill files while legacy consumers remain active", async () => {
        await SkillFileStore.saveSkillFile(createSkillSource("Legacy"));
        await LogseqPluginStorageManager.saveFile(
            "skills/new-skill",
            "SKILL.md",
            createSkillSource("new-skill")
        );
        await LogseqPluginStorageManager.saveFile(
            "skills/new-skill",
            "references/example.md",
            "reference"
        );
        expect((await SkillFileStore.getAllSkillFile()).map((skill) => skill.name)).toEqual([
            "Legacy"
        ]);
    });
});
