import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {SkillStore} from "../../../../../src/core/stores/skill-store/SkillStore";
import {MustacheView} from "../../../../../src/core/template-engine";
import {LogseqPluginStorageManager as Storage} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const content = (name: string, metadata = "", body = "Instructions") =>
    `---\nname: ${name}\ndescription: Example\n${metadata}---\n${body}`;

describe("SkillStore.saveEditedSkills", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        Storage.store = new InMemoryStore("edited-skills");
        vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
    });
    afterEach(() => vi.restoreAllMocks());

    test("captures fresh resources and auxiliary files for edits and renames", async () => {
        await SkillStore.saveSkillFile(content("alpha"), {
            references: {"deep/info": "reference"},
            scripts: {"run.sh": "script"}
        });
        await Storage.saveFile("skills/alpha", "assets/deep/file", "auxiliary");
        await SkillStore.saveEditedSkills(
            [{originalSkillName: "alpha", content: content("beta", "", "Edited")}],
            ["alpha"]
        );
        expect(await SkillStore.getSkillFiles("beta")).toEqual({
            "SKILL.md": content("beta", "", "Edited"),
            "references/deep/info": "reference",
            "scripts/run.sh": "script",
            "assets/deep/file": "auxiliary"
        });
        expect(await SkillStore.listSkillFiles("alpha")).toEqual([]);
        await SkillStore.saveEditedSkills(
            [{originalSkillName: "beta", content: content("beta", "", "Edited again")}],
            ["beta"]
        );
        expect((await SkillStore.getSkillFiles("beta"))["assets/deep/file"]).toBe("auxiliary");
    });

    test("swaps and rename-into-deleted-name preserve source resource identity", async () => {
        await SkillStore.saveSkillFile(content("alpha"), {references: {a: "alpha"}});
        await SkillStore.saveSkillFile(content("beta"), {references: {b: "beta"}});
        await SkillStore.saveEditedSkills(
            [
                {originalSkillName: "alpha", content: content("beta")},
                {originalSkillName: "beta", content: content("alpha")}
            ],
            ["alpha", "beta"]
        );
        expect(await SkillStore.getSkillFiles("beta")).toEqual({
            "SKILL.md": content("beta"),
            "references/a": "alpha"
        });
        expect(await SkillStore.getSkillFiles("alpha")).toEqual({
            "SKILL.md": content("alpha"),
            "references/b": "beta"
        });
        await SkillStore.saveEditedSkills(
            [{originalSkillName: "alpha", content: content("beta")}],
            ["alpha", "beta"]
        );
        expect(await SkillStore.getSkillFiles("beta")).toEqual({
            "SKILL.md": content("beta"),
            "references/b": "beta"
        });
        expect(await SkillStore.listSkillFiles("alpha")).toEqual([]);
    });

    test.each([
        "unrelated",
        "malformed",
        "resource-only"
    ])("rejects %s occupied destinations before writes", async (kind) => {
        await SkillStore.saveSkillFile(content("alpha"));
        if (kind === "unrelated") await SkillStore.saveSkillFile(content("beta"));
        if (kind === "malformed") await Storage.saveFile("skills/beta", "SKILL.md", "broken");
        if (kind === "resource-only")
            await Storage.saveFile("skills/beta", "references/file", "unseen");
        const before = await Storage.store.allKeys();
        const save = vi.spyOn(Storage, "saveFile");
        await expect(
            SkillStore.saveEditedSkills(
                [{originalSkillName: "alpha", content: content("beta")}],
                ["alpha"]
            )
        ).rejects.toThrow(/occupied/);
        expect(save).not.toHaveBeenCalled();
        expect(await Storage.store.allKeys()).toEqual(before);
    });

    test("preflights names, source identities, duplicates, and templates", async () => {
        await SkillStore.saveSkillFile(content("alpha"));
        const save = vi.spyOn(Storage, "saveFile");
        for (const entries of [
            [{content: content("Bad")}],
            [{originalSkillName: "missing", content: content("beta")}],
            [{content: content("beta")}, {content: content("beta")}],
            [
                {originalSkillName: "alpha", content: content("beta")},
                {originalSkillName: "alpha", content: content("gamma")}
            ],
            [{content: content("beta", "", "<% unknown %>")}]
        ])
            await expect(SkillStore.saveEditedSkills(entries, ["alpha"])).rejects.toThrow();
        expect(save).not.toHaveBeenCalled();
    });

    test("enforces persisted built-in permissions and permits only controllable invocation changes", async () => {
        const original = content(
            "builtin",
            "built-in-skill: true\nbuilt-in-skill-user-controllable: true\ndisable-model-invocation: false\n"
        );
        await SkillStore.saveSkillFile(original);
        for (const entries of [
            [],
            [
                {
                    originalSkillName: "builtin",
                    content: original.replace("name: builtin", "name: renamed")
                }
            ],
            [{originalSkillName: "builtin", content: original + "changed"}],
            [
                {
                    originalSkillName: "builtin",
                    content: original.replace("built-in-skill: true", "built-in-skill: false")
                }
            ],
            [{content: original}]
        ]) {
            await expect(SkillStore.saveEditedSkills(entries, ["builtin"])).rejects.toThrow();
        }
        await SkillStore.saveEditedSkills(
            [
                {
                    originalSkillName: "builtin",
                    content: original.replace(
                        "disable-model-invocation: false",
                        "disable-model-invocation: true"
                    )
                }
            ],
            ["builtin"]
        );
        expect((await SkillStore.getSkill("builtin"))?.disableModelInvocation).toBe(true);
        const fixed = original.replace(
            "built-in-skill-user-controllable: true",
            "built-in-skill-user-controllable: false"
        );
        await SkillStore.saveSkillFile(fixed);
        await expect(
            SkillStore.saveEditedSkills(
                [
                    {
                        originalSkillName: "builtin",
                        content: fixed.replace(
                            "disable-model-invocation: false",
                            "disable-model-invocation: true"
                        )
                    }
                ],
                ["builtin"]
            )
        ).rejects.toThrow(/read-only/);
    });

    test.each([
        "write",
        "delete"
    ])("restores all folders after a partial %s failure", async (kind) => {
        await SkillStore.saveSkillFile(content("alpha"), {references: {file: "resource"}});
        await SkillStore.saveSkillFile(content("beta"));
        const alpha = await SkillStore.getSkillFiles("alpha");
        const beta = await SkillStore.getSkillFiles("beta");
        const failure = new Error("injected failure");
        if (kind === "write") vi.spyOn(Storage, "saveFile").mockRejectedValueOnce(failure);
        else vi.spyOn(Storage, "deleteFile").mockRejectedValueOnce(failure);
        await expect(
            SkillStore.saveEditedSkills(
                [{originalSkillName: "alpha", content: content("gamma")}],
                ["alpha", "beta"]
            )
        ).rejects.toBe(failure);
        expect(await SkillStore.getSkillFiles("alpha")).toEqual(alpha);
        expect(await SkillStore.getSkillFiles("beta")).toEqual(beta);
        expect(await SkillStore.listSkillFiles("gamma")).toEqual([]);
    });

    test("does not delete any source before destination writes complete", async () => {
        await SkillStore.saveSkillFile(content("alpha"));
        await SkillStore.saveSkillFile(content("beta"));
        const save = Storage.saveFile.bind(Storage);
        const remove = vi.spyOn(Storage, "deleteFile");
        vi.spyOn(Storage, "saveFile").mockImplementation(async (...args) => {
            expect(remove).not.toHaveBeenCalled();
            return save(...args);
        });
        await SkillStore.saveEditedSkills(
            [
                {originalSkillName: "alpha", content: content("gamma")},
                {originalSkillName: "beta", content: content("delta")}
            ],
            ["alpha", "beta"]
        );
        expect(remove).toHaveBeenCalled();
    });

    test("restores a source folder already deleted when a later deletion fails", async () => {
        await SkillStore.saveSkillFile(content("alpha"));
        await SkillStore.saveSkillFile(content("beta"), {references: {file: "beta resource"}});
        const alpha = await SkillStore.getSkillFiles("alpha");
        const beta = await SkillStore.getSkillFiles("beta");
        const remove = Storage.deleteFile.bind(Storage);
        const failure = new Error("later deletion failed");
        let failed = false;
        vi.spyOn(Storage, "deleteFile").mockImplementation(async (...args) => {
            if (args[0] === "skills/beta" && !failed) {
                failed = true;
                throw failure;
            }
            return remove(...args);
        });
        await expect(SkillStore.saveEditedSkills([], ["alpha", "beta"])).rejects.toBe(failure);
        expect(await SkillStore.getSkillFiles("alpha")).toEqual(alpha);
        expect(await SkillStore.getSkillFiles("beta")).toEqual(beta);
    });

    test("writes all destinations before cleaning stale resources during swaps", async () => {
        await SkillStore.saveSkillFile(content("alpha"), {references: {a: "alpha"}});
        await SkillStore.saveSkillFile(content("beta"), {references: {b: "beta"}});
        const save = Storage.saveFile.bind(Storage);
        const remove = vi.spyOn(Storage, "deleteFile");
        vi.spyOn(Storage, "saveFile").mockImplementation(async (...args) => {
            expect(remove).not.toHaveBeenCalled();
            return save(...args);
        });
        await SkillStore.saveEditedSkills(
            [
                {originalSkillName: "alpha", content: content("beta")},
                {originalSkillName: "beta", content: content("alpha")}
            ],
            ["alpha", "beta"]
        );
        expect(remove).toHaveBeenCalledTimes(2);
    });

    test("reports original and rollback failures and allows subsequent retries", async () => {
        await SkillStore.saveSkillFile(content("alpha"));
        const writeFailure = new Error("write failed");
        const rollbackFailure = new Error("rollback failed");
        const save = Storage.saveFile.bind(Storage);
        vi.spyOn(Storage, "saveFile").mockImplementation(async (...args) => {
            if (args[1] !== "SKILL.md") throw writeFailure;
            return save(...args);
        });
        vi.spyOn(Storage, "deleteFile").mockRejectedValue(rollbackFailure);
        await Storage.store.setItem("skills/alpha/references/file", "resource");
        await expect(
            SkillStore.saveEditedSkills(
                [{originalSkillName: "alpha", content: content("beta")}],
                ["alpha"]
            )
        ).rejects.toMatchObject({errors: [writeFailure, rollbackFailure]});
        vi.restoreAllMocks();
        vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue([]);
        await SkillStore.saveEditedSkills(
            [{originalSkillName: "alpha", content: content("alpha")}],
            ["alpha"]
        );
    });

    test("serializes editor and privileged folder writes", async () => {
        await SkillStore.saveSkillFile(content("alpha"));
        const save = Storage.saveFile.bind(Storage);
        let unblock!: () => void;
        const blocked = new Promise<void>((resolve) => {
            unblock = resolve;
        });
        let started!: () => void;
        const entered = new Promise<void>((resolve) => {
            started = resolve;
        });
        vi.spyOn(Storage, "saveFile").mockImplementationOnce(async (...args) => {
            started();
            await blocked;
            return save(...args);
        });
        const editor = SkillStore.saveEditedSkills(
            [{originalSkillName: "alpha", content: content("alpha", "", "Edited")}],
            ["alpha"]
        );
        await entered;
        const privileged = SkillStore.replaceSkillFolder(content("alpha", "", "Bundled"));
        unblock();
        await Promise.all([editor, privileged]);
        expect((await SkillStore.getSkill("alpha"))?.content).toBe(content("alpha", "", "Bundled"));
    });
});
