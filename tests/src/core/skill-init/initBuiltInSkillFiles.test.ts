import aliasQuery from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import pageMembership from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PAGE_MEMBERSHIP.ds?raw";
import propertyReverseLookup from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PROPERTY_REVERSE_LOOKUP.ds?raw";
import recursiveInheritance from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/RECURSIVE_CLASS_INHERITANCE.ds?raw";
import statusHistory from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/STATUS_HISTORY.ds?raw";
import recursiveBacklinks from "src/chat-app/prompts/skills/logseq-datascript-queries/internal/RECURSIVE_PAGE_REFERENCE_BACKLINKS.ds?raw";
import bilibiliTranscript from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py?raw";
import readSkillFile from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/READ_SKILL_FILE.sh?raw";
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

    test("installs separate timestamp blocks and coherent transcript grouping guidance", async () => {
        await initBuiltInSkillFiles();
        const skill = (await SkillStore.getSkill("logseq-video-and-web-embeds"))!;
        expect(skill.content).toContain(
            "- Use `{{youtube-timestamp ...}}` only in a child block of its video embed.\n" +
                "- Give each `{{youtube-timestamp ...}}` annotation its own child block, together with the corresponding text."
        );
        expect(skill.content).toContain(
            "Group transcript fragments into complete sentences or coherent passages rather than copying the transcript API's segment boundaries."
        );
    });

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
            [
                ...expectedResources.map((path) => `logseq-datascript-queries/${path}`),
                "working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py"
            ].sort()
        );
        expect(await SkillStore.getSkillFiles("logseq-datascript-queries")).toMatchObject(
            expectedExamples
        );
        const bash = await SkillStore.getSkill("working-with-bash-and-pyodide");
        expect(bash?.content).toContain("micropip");
        expect(bash?.content).toContain("sympy==1.14.0");
        expect(bash?.content).toContain("youtube-transcript-api==1.2.4");
        expect(bash?.content).toContain("Pillow==12.2.0");
        expect(bash?.content).toContain(readSkillFile.trim());
        expect(bash?.content).not.toContain("qjs");
        expect(bash?.content).not.toContain("includeFile");
        const internalSources = import.meta.glob(
            "../../../../src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/*.py",
            {eager: true, query: "?raw", import: "default"}
        );
        expect(Object.keys(internalSources)).toHaveLength(6);
        const embeddedSources = [
            ...bash!.content.matchAll(/```bash\npython - <<'PY'\n([\s\S]*?)\nPY\n```/g)
        ].map((match) => match[1]);
        expect(embeddedSources).toHaveLength(6);
        for (const source of Object.values(internalSources))
            expect(embeddedSources).toContain((source as string).trim());
        expect(await SkillStore.getSkillFiles("working-with-bash-and-pyodide")).toMatchObject({
            "examples/BILIBILI_TRANSCRIPT.py": bilibiliTranscript
        });
        expect(
            await parseTemplateString(bash!.content, {virEnvUserPath: VIR_ENV_USER_PATH})
        ).toContain(
            `${VIR_ENV_USER_PATH}/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py`
        );
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

    test("replaces the obsolete Bash built-in folder with the renamed bundle", async () => {
        await SkillStore.saveSkillFile(
            "---\nname: working-with-bash\ndescription: Old Bash skill\nbuilt-in-skill: true\n---\nOld",
            {examples: {"nested/old.py": "print('old')"}}
        );
        await initBuiltInSkillFiles();
        expect(await SkillStore.listSkillFiles("working-with-bash")).toEqual([]);
        expect(await SkillStore.listSkillFiles("working-with-bash-and-pyodide")).toEqual([
            "SKILL.md",
            "examples/BILIBILI_TRANSCRIPT.py"
        ]);
        expect(await SkillStore.getAllSkills()).toHaveLength(6);
    });

    test.each(["user-owned", "malformed"])("preserves a %s renamed destination", async (kind) => {
        const name = "working-with-bash-and-pyodide";
        const content =
            kind === "malformed"
                ? "User instructions without frontmatter"
                : `---\nname: ${name}\ndescription: User instructions\n---\nUser body`;
        await Storage.saveFile(`skills/${name}`, "SKILL.md", content);
        await initBuiltInSkillFiles();
        expect(await Storage.getFileContent(`skills/${name}`, "SKILL.md")).toBe(content);
        expect(await SkillStore.listSkillFiles(name)).toEqual(["SKILL.md"]);
    });

    test.each(["edit", "remove", "add"])("repairs Bash example resource %s", async (change) => {
        await initBuiltInSkillFiles();
        const group = "skills/working-with-bash-and-pyodide";
        const path = "examples/BILIBILI_TRANSCRIPT.py";
        if (change === "edit") await Storage.saveFile(group, path, "changed");
        if (change === "remove") await Storage.deleteFile(group, path);
        if (change === "add") await Storage.saveFile(group, "internal/unbundled.py", "extra");
        await initBuiltInSkillFiles();
        expect(await Storage.getFileContent(group, path)).toBe(bilibiliTranscript);
        expect(await SkillStore.listSkillFiles("working-with-bash-and-pyodide")).toEqual([
            "SKILL.md",
            path
        ]);
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
