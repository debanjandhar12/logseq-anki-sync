import aliasQuery from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {initBuiltInSkillFiles} from "../../../../src/core/skill-init/initBuiltInSkillFiles";
import {parseSkillFile} from "../../../../src/core/skill-parser";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

describe("initBuiltInSkillFiles", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("built-in-skill-test");
    });
    afterEach(() => vi.restoreAllMocks());

    test("installs seven matching folders and the alias query example", async () => {
        await initBuiltInSkillFiles();
        const skills = await SkillStore.getAllSkills();
        expect(skills).toHaveLength(7);
        for (const skill of skills) {
            expect(parseSkillFile(skill.content).name).toBe(skill.folderName);
            expect(skill.builtInSkill).toBe(true);
        }
        const paths = await Storage.getFiles("skills");
        expect(paths.filter((path) => !path.endsWith("/SKILL.md")).sort()).toEqual([
            "logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds"
        ]);
        expect(await SkillStore.getSkillFiles("logseq-datascript-queries")).toMatchObject({
            "examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds": aliasQuery
        });
        const bash = await SkillStore.getSkill("working-with-bash");
        expect(bash?.content).toContain("micropip");
        expect(bash?.content).toContain("scipy==1.18.0");
        expect(bash?.content).toContain("youtube-transcript-api==1.2.4");
        expect(bash?.content).not.toContain("qjs");
        expect((await SkillStore.getSkill("logseq-datascript-queries"))?.content).not.toContain(
            "includeFile"
        );
        expect((await SkillStore.getSkill("logseq-datascript-queries"))?.content).toContain(
            "[?b :block/title ?title]"
        );
        expect((await SkillStore.getSkill("logseq-datascript-query-pitfalls"))?.content).toContain(
            "[?b :block/content ?content]"
        );
    });

    test("bundled source names match their actual source folders", () => {
        const sources = import.meta.glob("../../../../src/chat-app/prompts/skills/*/SKILL.md", {
            eager: true,
            query: "?raw",
            import: "default"
        });
        expect(Object.keys(sources)).toHaveLength(7);
        for (const [path, content] of Object.entries(sources)) {
            expect(parseSkillFile(content as string).name).toBe(path.split("/").at(-2));
        }
    });

    test("preserves malformed and user-owned occupied folders", async () => {
        await Storage.saveFile("skills/skill-creator", "SKILL.md", "malformed user content");
        const user = "---\nname: working-with-bash\ndescription: User instructions\n---\nUser body";
        await SkillStore.saveSkillFile(user);
        await initBuiltInSkillFiles();
        expect(await Storage.getFileContent("skills/skill-creator", "SKILL.md")).toBe(
            "malformed user content"
        );
        expect((await SkillStore.getSkill("working-with-bash"))?.content).toBe(user);
    });

    test("unchanged bundles and invocation-only changes perform no writes", async () => {
        await initBuiltInSkillFiles();
        const original = (await SkillStore.getSkill("skill-creator"))!.content;
        await SkillStore.saveSkillFile(
            original.replace("disable-model-invocation: false", "disable-model-invocation: true")
        );
        const save = vi.spyOn(Storage, "saveFile");
        const remove = vi.spyOn(Storage, "deleteFile");
        await initBuiltInSkillFiles();
        expect(save).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect((await SkillStore.getSkill("skill-creator"))?.disableModelInvocation).toBe(true);
    });

    test.each([
        "edit",
        "remove",
        "add"
    ])("resource %s triggers authoritative replacement and preference reset", async (change) => {
        await initBuiltInSkillFiles();
        const name = "logseq-datascript-queries";
        const original = (await SkillStore.getSkill(name))!.content;
        await SkillStore.saveSkillFile(
            original.replace("disable-model-invocation: false", "disable-model-invocation: true")
        );
        if (change === "edit")
            await Storage.saveFile(
                `skills/${name}`,
                "examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds",
                "changed"
            );
        if (change === "remove")
            await Storage.deleteFile(`skills/${name}`, "examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds");
        if (change === "add")
            await Storage.saveFile(`skills/${name}`, "auxiliary/deep/extra.txt", "extra");
        await initBuiltInSkillFiles();
        expect((await SkillStore.getSkill(name))?.content).toBe(original);
        expect(await SkillStore.listSkillFiles(name)).toEqual([
            "SKILL.md",
            "examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds"
        ]);
    });

    test("instruction changes reset preferences and obsolete built-in folders are removed recursively", async () => {
        await initBuiltInSkillFiles();
        const original = (await SkillStore.getSkill("skill-creator"))!.content;
        await SkillStore.saveSkillFile(
            original.replace("disable-model-invocation: false", "disable-model-invocation: true") +
                "\nChanged"
        );
        await SkillStore.saveSkillFile(
            "---\nname: obsolete\ndescription: Old\nbuilt-in-skill: true\n---\nOld",
            {references: {"nested/file": "old"}}
        );
        await initBuiltInSkillFiles();
        expect((await SkillStore.getSkill("skill-creator"))?.content).toBe(original);
        expect(await SkillStore.listSkillFiles("obsolete")).toEqual([]);
    });
});
