import aliasQuery from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import pageMembership from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PAGE_MEMBERSHIP.ds?raw";
import propertyReverseLookup from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PROPERTY_REVERSE_LOOKUP.ds?raw";
import recursiveInheritance from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/RECURSIVE_CLASS_INHERITANCE.ds?raw";
import statusHistory from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/STATUS_HISTORY.ds?raw";
import recursiveBacklinks from "src/chat-app/prompts/skills/logseq-datascript-queries/internal/RECURSIVE_PAGE_REFERENCE_BACKLINKS.ds?raw";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {VIR_ENV_USER_PATH} from "../../../../src/constants";
import {initBuiltInSkillFiles} from "../../../../src/core/skill-init/initBuiltInSkillFiles";
import {parseSkillFile} from "../../../../src/core/skill-parser";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {parseTemplateString} from "../../../../src/core/template-engine/renderer/parseTemplateString";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const expectedExamples = {
    "examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds": aliasQuery,
    "examples/PAGE_MEMBERSHIP.ds": pageMembership,
    "examples/PROPERTY_REVERSE_LOOKUP.ds": propertyReverseLookup,
    "examples/RECURSIVE_CLASS_INHERITANCE.ds": recursiveInheritance,
    "examples/STATUS_HISTORY.ds": statusHistory
};
const expectedResources = [...Object.keys(expectedExamples), "references/query-pitfalls.md"].sort();

describe("initBuiltInSkillFiles", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("built-in-skill-test");
    });
    afterEach(() => vi.restoreAllMocks());

    test("installs six matching folders with exact query examples, rules, and debugging reference", async () => {
        await initBuiltInSkillFiles();
        const skills = await SkillStore.getAllSkills();
        expect(skills).toHaveLength(6);
        for (const skill of skills) {
            expect(parseSkillFile(skill.content).name).toBe(skill.folderName);
            expect(skill.builtInSkill).toBe(true);
        }
        const paths = await Storage.getFiles("skills");
        expect(paths.filter((path) => !path.endsWith("/SKILL.md")).sort()).toEqual(
            expectedResources.map((path) => `logseq-datascript-queries/${path}`)
        );
        expect(await SkillStore.getSkillFiles("logseq-datascript-queries")).toMatchObject(
            expectedExamples
        );
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
        const querySkill = (await SkillStore.getSkill("logseq-datascript-queries"))!;
        expect(querySkill.content).toContain(recursiveBacklinks.trim());
        expect(querySkill.content).not.toContain(statusHistory.trim());
        expect(querySkill.content).not.toContain(recursiveInheritance.trim());
        const reference = (await SkillStore.getSkillFiles("logseq-datascript-queries"))[
            "references/query-pitfalls.md"
        ];
        expect(reference).toContain("[?b :block/content ?content]");
        expect(reference).not.toContain("includeFile");
        expect(reference).not.toContain("built-in-skill:");
        expect(await SkillStore.getSkill("logseq-datascript-query-pitfalls")).toBeNull();
        const rendered = await parseTemplateString(
            (await SkillStore.getSkill("logseq-datascript-queries"))!.content,
            {virEnvUserPath: VIR_ENV_USER_PATH}
        );
        expect(rendered).toContain(
            `${VIR_ENV_USER_PATH}/skills/logseq-datascript-queries/references/query-pitfalls.md`
        );
    });

    test("bundled source names match their actual source folders", () => {
        const sources = import.meta.glob("../../../../src/chat-app/prompts/skills/*/SKILL.md", {
            eager: true,
            query: "?raw",
            import: "default"
        });
        expect(Object.keys(sources)).toHaveLength(6);
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
        expect(await SkillStore.listSkillFiles(name)).toEqual(["SKILL.md", ...expectedResources]);
    });

    test("instruction changes reset preferences and obsolete built-in folders are removed recursively", async () => {
        await initBuiltInSkillFiles();
        const original = (await SkillStore.getSkill("skill-creator"))!.content;
        await SkillStore.saveSkillFile(
            original.replace("disable-model-invocation: false", "disable-model-invocation: true") +
                "\nChanged"
        );
        await SkillStore.saveSkillFile(
            "---\nname: logseq-datascript-query-pitfalls\ndescription: Old\nbuilt-in-skill: true\n---\nOld",
            {references: {"nested/file": "old"}}
        );
        await initBuiltInSkillFiles();
        expect((await SkillStore.getSkill("skill-creator"))?.content).toBe(original);
        expect(await SkillStore.listSkillFiles("logseq-datascript-query-pitfalls")).toEqual([]);
    });
});
