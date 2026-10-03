import {createHash} from "node:crypto";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {hashSkillFileSnapshot} from "../../../../src/core/stores/skill-store/hashSkillFileSnapshot";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

function content(name = "example", extra = ""): string {
    return `---\nname: ${name}\ndescription: Example skill\n${extra}---\n\nInstructions\n`;
}

describe("SkillStore", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("skill-folders");
        vi.restoreAllMocks();
    });

    test("discovers only matching valid folders, sorting built-ins first", async () => {
        await SkillStore.saveSkillFile(content("z-user"));
        await SkillStore.saveSkillFile(content("a-user"));
        await SkillStore.saveSkillFile(content("z-builtin", "built-in-skill: true\n"), {
            references: {"nested/info.md": "resource"}
        });
        await SkillStore.saveSkillFile(content("a-builtin", "built-in-skill: true\n"));
        await Storage.saveFile("skills", "legacy.md", content("legacy"));
        await Storage.saveFile("skills/mismatch", "SKILL.md", content("different"));
        await Storage.saveFile("skills/broken", "SKILL.md", "not a skill");
        await Storage.saveFile("skills/Invalid", "SKILL.md", content("Invalid"));
        expect((await SkillStore.getAllSkills()).map((skill) => skill.folderName)).toEqual([
            "a-builtin",
            "z-builtin",
            "a-user",
            "z-user"
        ]);
        expect(await SkillStore.getSkill("mismatch")).toBeNull();
        expect(await SkillStore.skillExists("broken")).toBe(true);
        expect(await SkillStore.getSkill("missing")).toBeNull();
    });

    test("preserves omitted resources and replaces supplied categories", async () => {
        await SkillStore.saveSkillFile(content(), {
            references: {"nested/info.md": "reference", ".hidden": "hidden"},
            scripts: {"run.sh": "script"}
        });
        const edited = content().replace("Instructions", "Edited");
        await SkillStore.saveSkillFile(edited);
        expect(await SkillStore.getSkillFiles("example")).toEqual({
            "SKILL.md": edited,
            "references/nested/info.md": "reference",
            "references/.hidden": "hidden",
            "scripts/run.sh": "script"
        });
        await SkillStore.saveSkillFile(edited, {references: {"new.ds": "query"}});
        expect(await SkillStore.listSkillFiles("example")).toEqual([
            "SKILL.md",
            "references/new.ds",
            "scripts/run.sh"
        ]);
        await SkillStore.saveSkillFile(edited, {scripts: {}});
        expect(await SkillStore.listSkillFiles("example")).toEqual([
            "SKILL.md",
            "references/new.ds"
        ]);
        await SkillStore.deleteSkill("example");
        expect(await SkillStore.listSkillFiles("example")).toEqual([]);
    });

    test.each([
        "Uppercase",
        "space name",
        "name_underscore",
        "name.dot",
        "é",
        "-name",
        "name-",
        "name--other",
        " name ",
        "a".repeat(65)
    ])("rejects invalid raw name %j before writes", async (name) => {
        await expect(SkillStore.saveSkillFile(content(`"${name}"`))).rejects.toThrow();
        expect(await Storage.getFiles("skills")).toEqual([]);
    });

    test("accepts name boundaries and rejects excessive descriptions", async () => {
        await SkillStore.saveSkillFile(content("a"));
        await SkillStore.saveSkillFile(content("a".repeat(64)));
        const boundary = content().replace("Example skill", "a".repeat(1024));
        await SkillStore.saveSkillFile(boundary);
        await expect(
            SkillStore.saveSkillFile(content().replace("Example skill", "a".repeat(1025)))
        ).rejects.toThrow();
        await expect(
            SkillStore.saveSkillFile(content().replace("Example skill", '"   "'))
        ).rejects.toThrow();
    });

    test("rejects traversal, nontext resources and file/directory collisions before writes", async () => {
        await SkillStore.saveSkillFile(content(), {scripts: {"run.sh": "original"}});
        const original = await SkillStore.getSkillFiles("example");
        for (const resources of [
            {"../escape": "bad"},
            {"a//b": "bad"},
            {a: "file", "a/b": "child"},
            {"not-text": 3}
        ]) {
            await expect(
                SkillStore.saveSkillFile(content(), {
                    references: resources as Record<string, string>
                })
            ).rejects.toThrow();
            expect(await SkillStore.getSkillFiles("example")).toEqual(original);
        }
        await Storage.saveFile("skills/example", "references", "preserved file");
        await expect(
            SkillStore.saveSkillFile(content(), {references: {child: "text"}})
        ).rejects.toThrow(/collision/);
    });

    test("hashes complete folders deterministically, ignoring only the optional preference", async () => {
        const source = content(
            "example",
            "disable-model-invocation: false\nmetadata:\n  b: 2\n  a: 1\n"
        );
        await SkillStore.saveSkillFile(source, {references: {"query.ds": "query"}});
        const hash = await SkillStore.hashSkillFiles("example");
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        await Storage.deleteFile("skills/example", "references/query.ds");
        await Storage.saveFile("skills/example", "references/query.ds", "query");
        expect(await SkillStore.hashSkillFiles("example")).toBe(hash);

        const toggled = source.replace("false", "true").replace("  b: 2\n  a: 1", "  a: 1\n  b: 2");
        await Storage.saveFile("skills/example", "SKILL.md", toggled);
        expect(await SkillStore.hashSkillFiles("example")).not.toBe(hash);
        const options = {ignoreDisableModelInvocation: true};
        const comparable = await SkillStore.hashSkillFiles("example", options);
        await Storage.saveFile("skills/example", "SKILL.md", source);
        expect(await SkillStore.hashSkillFiles("example", options)).toBe(comparable);
        await Storage.saveFile(
            "skills/example",
            "SKILL.md",
            source.replace("Instructions", "Changed")
        );
        expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(comparable);
        await expect(SkillStore.hashSkillFiles("missing")).rejects.toThrow(/Missing or invalid/);
    });

    test("folder hashing recursively discovers nested files and isolates the selected skill", async () => {
        await SkillStore.saveSkillFile(content(), {
            references: {"one/two/three/info.md": "reference"},
            scripts: {"one/two/run.sh": "script"}
        });
        await Storage.saveFile("skills/example", "assets/one/two/data.txt", "asset");
        const options = {ignoreDisableModelInvocation: true};
        const original = await SkillStore.hashSkillFiles("example", options);
        expect(await SkillStore.listSkillFiles("example")).toEqual([
            "SKILL.md",
            "assets/one/two/data.txt",
            "references/one/two/three/info.md",
            "scripts/one/two/run.sh"
        ]);
        await Storage.saveFile("skills/example-other", "nested/info.md", "unrelated");
        expect(await SkillStore.hashSkillFiles("example", options)).toBe(original);

        for (const path of [
            "references/one/two/three/info.md",
            "scripts/one/two/run.sh",
            "assets/one/two/data.txt"
        ]) {
            const previous = await Storage.getFileContent("skills/example", path);
            await Storage.saveFile("skills/example", path, "changed");
            expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(original);
            await Storage.deleteFile("skills/example", path);
            expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(original);
            await Storage.saveFile("skills/example", `${path}.renamed`, previous!);
            expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(original);
            await Storage.deleteFile("skills/example", `${path}.renamed`);
            await Storage.saveFile("skills/example", path, previous!);
            expect(await SkillStore.hashSkillFiles("example", options)).toBe(original);
        }

        await Storage.saveFile("skills/example", "new/deeply/nested/file.md", "added");
        expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(original);
        await Storage.deleteFile("skills/example", "new/deeply/nested/file.md");
        expect(await SkillStore.hashSkillFiles("example", options)).toBe(original);

        await Storage.saveFile("skills/example", "nested/SKILL.md", "nested instructions");
        expect(await SkillStore.hashSkillFiles("example", options)).not.toBe(original);
    });

    test("propagates storage read/write/delete failures", async () => {
        await SkillStore.saveSkillFile(content());
        const failure = new Error("storage unavailable");
        const read = vi.spyOn(Storage, "getFileContent").mockRejectedValue(failure);
        await expect(SkillStore.getSkill("example")).rejects.toBe(failure);
        await expect(SkillStore.getAllSkills()).rejects.toBe(failure);
        read.mockRestore();
        const write = vi.spyOn(Storage, "saveFile").mockRejectedValueOnce(failure);
        await expect(
            SkillStore.saveSkillFile(content().replace("Instructions", "Changed"))
        ).rejects.toBe(failure);
        write.mockRestore();
        vi.spyOn(Storage, "deleteFile").mockRejectedValue(failure);
        await expect(SkillStore.deleteSkill("example")).rejects.toBe(failure);
    });

    test("hashes without browser Web Crypto and retains the SHA-256 format", async () => {
        const source = content();
        const resourcePath = "references/nested/世界.md";
        const resourceContent = "Unicode contents 世界";
        await SkillStore.saveSkillFile(source, {references: {"nested/世界.md": resourceContent}});
        const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
        const expected = digest(
            JSON.stringify([
                "skill-files-v1",
                digest(source),
                digest(JSON.stringify([[resourcePath, resourceContent]]))
            ])
        );
        vi.stubGlobal("crypto", undefined);
        expect(hashSkillFileSnapshot({"SKILL.md": source, [resourcePath]: resourceContent})).toBe(
            expected
        );
        expect(await SkillStore.hashSkillFiles("example")).toBe(expected);
    });

    test("replaces resource path shapes and restores original files after a partial write", async () => {
        await SkillStore.saveSkillFile(content(), {references: {entry: "flat", "keep.md": "keep"}});
        await SkillStore.saveSkillFile(content(), {
            references: {"entry/child.md": "nested", "keep.md": "keep"}
        });
        expect(await SkillStore.listSkillFiles("example")).toEqual([
            "SKILL.md",
            "references/entry/child.md",
            "references/keep.md"
        ]);
        const original = await SkillStore.getSkillFiles("example");
        const save = Storage.saveFile.bind(Storage);
        let writes = 0;
        const failure = new Error("second write failed");
        const mock = vi.spyOn(Storage, "saveFile").mockImplementation(async (...args) => {
            writes += 1;
            if (writes === 2) throw failure;
            return save(...args);
        });
        await expect(
            SkillStore.saveSkillFile(content().replace("Instructions", "Edited"), {
                references: {entry: "flat again"}
            })
        ).rejects.toBe(failure);
        expect(await SkillStore.getSkillFiles("example")).toEqual(original);
        mock.mockRestore();
        await SkillStore.saveSkillFile(content(), {references: {entry: "flat again"}});
        expect(await SkillStore.getSkillFiles("example")).toEqual({
            "SKILL.md": content(),
            "references/entry": "flat again"
        });
    });

    test("reports both save and rollback errors", async () => {
        await SkillStore.saveSkillFile(content());
        const failure = new Error("persistent write failure");
        const save = Storage.saveFile.bind(Storage);
        vi.spyOn(Storage, "saveFile").mockImplementation(async (...args) => {
            // A backend may commit before reporting failure; restoration must then write back.
            await save(...args);
            throw failure;
        });
        await expect(
            SkillStore.saveSkillFile(content().replace("Instructions", "Edited"))
        ).rejects.toMatchObject({
            message: "Failed to save and restore skill: example",
            errors: [failure, failure]
        });
    });
});
