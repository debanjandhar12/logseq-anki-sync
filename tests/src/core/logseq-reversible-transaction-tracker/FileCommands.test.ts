import {Buffer} from "buffer";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {
    DeleteCommandFileCommand,
    DeleteSkillFileCommand,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer,
    PutAssetFileCommand,
    PutCommandFileCommand,
    PutSkillFileCommand,
    ReadAssetFileCommand,
    ReadCommandFileCommand,
    ReadSkillFileCommand,
    LogseqReversibleTransactionCommandSerializer as Serializer
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {resolveGraphAssetPath} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/resolveGraphAssetPath";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import {SkillStore} from "../../../../src/core/stores/skill-store/SkillStore";
import {MustacheView} from "../../../../src/core/template-engine";
import {LogseqPluginStorageManager as Storage} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";

const skill = (name = "alpha", metadata = "", body = "Instructions") =>
    `---\nname: ${name}\ndescription: Example\n${metadata}---\n${body}`;
const command = (name = "Alpha", metadata = "", body = "Instructions") =>
    `---\nname: ${name}\ninvoke-location:\n  - Logseq Command Center\n${metadata}---\n${body}`;
const roundTrip = (value: Parameters<typeof Serializer.serialize>[0]) =>
    Serializer.deserialize(JSON.parse(JSON.stringify(Serializer.serialize(value))));

beforeEach(() => {
    InMemoryStore.clearAll();
    Storage.store = new InMemoryStore("file-commands");
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("skill and command file commands", () => {
    test("updates only SKILL.md and undoes after serialization", async () => {
        await SkillStore.saveSkillFile(skill());
        await Storage.saveFile("skills/alpha", "templates/card.md", "custom resource");
        const put = new PutSkillFileCommand({
            skillName: "alpha",
            content: skill("alpha", "", "Edited")
        });
        expect(await put.execute()).toBe(true);
        expect(put.getChangedPages()).toEqual([]);
        expect(put.getChangedAssets()).toEqual([
            `assets/storages/${logseq.baseInfo.id}/skills/alpha/SKILL.md`
        ]);
        expect((await SkillStore.getSkillFiles("alpha"))["templates/card.md"]).toBe(
            "custom resource"
        );
        await roundTrip(put).revert();
        expect((await SkillStore.getSkill("alpha"))?.content).toBe(skill());
    });

    test("deletes and restores the complete arbitrary skill folder", async () => {
        await SkillStore.saveSkillFile(skill());
        await Storage.saveFile("skills/alpha", "templates/deep/card.md", "custom resource");
        const original = await SkillStore.getSkillFiles("alpha");
        const remove = new DeleteSkillFileCommand({skillName: "alpha"});
        await remove.execute();
        expect(remove.getChangedAssets()).toHaveLength(2);
        expect(await SkillStore.getSkillFiles("alpha")).toEqual({});
        await roundTrip(remove).revert();
        expect(await SkillStore.getSkillFiles("alpha")).toEqual(original);
    });

    test("undoes new skills without removing pre-existing auxiliary files", async () => {
        await Storage.saveFile("skills/alpha", "templates/card.md", "keep");
        const put = new PutSkillFileCommand({skillName: "alpha", content: skill()});
        await put.execute();
        await roundTrip(put).revert();
        expect(await SkillStore.getSkillFiles("alpha")).toEqual({"templates/card.md": "keep"});
    });

    test("upserts, deletes and restores command markdown with the correct .md filename", async () => {
        const put = new PutCommandFileCommand({commandName: "Alpha", content: command()});
        await put.execute();
        const remove = new DeleteCommandFileCommand({commandName: "Alpha"});
        await remove.execute();
        expect(await CommandFileStore.getCommandFileByName("Alpha")).toBeNull();
        await roundTrip(remove).revert();
        expect((await CommandFileStore.getCommandFileByName("Alpha"))?.content).toBe(command());
        await roundTrip(put).revert();
        expect(await CommandFileStore.getCommandFileByName("Alpha")).toBeNull();
    });

    test("command update undo retains exact original markdown", async () => {
        await CommandFileStore.saveCommandFile(command());
        const put = new PutCommandFileCommand({
            commandName: "Alpha",
            content: command("Alpha", "", "Edited")
        });
        await put.execute();
        await roundTrip(put).revert();
        expect((await CommandFileStore.getCommandFileByName("Alpha"))?.content).toBe(command());
    });

    test("reads raw malformed files, distinguishes absence, and resets lifecycle", async () => {
        await Storage.saveFile("skills/alpha", "SKILL.md", "malformed");
        const read = new ReadSkillFileCommand({skillName: "alpha"});
        expect(read.doesGraphMutations()).toBe(false);
        expect(await read.execute()).toEqual({exists: true, content: "malformed"});
        await expect(read.execute()).rejects.toThrow("already been executed");
        await roundTrip(read).revert();
        await read.revert();
        expect(await read.execute()).toEqual({exists: true, content: "malformed"});
        expect(await new ReadCommandFileCommand({commandName: "Missing"}).execute()).toEqual({
            exists: false,
            content: null
        });
    });

    test("rejects bad names, empty content, frontmatter mismatch and case collisions before mutation", async () => {
        expect(() => new ReadSkillFileCommand({skillName: "../alpha"})).toThrow();
        expect(() => new ReadCommandFileCommand({commandName: "../Alpha"})).toThrow();
        expect(() => new PutSkillFileCommand({skillName: "alpha", content: "  "})).toThrow();
        expect(() => new PutCommandFileCommand({commandName: "Alpha", content: "  "})).toThrow();
        await expect(
            new PutSkillFileCommand({skillName: "beta", content: skill()}).execute()
        ).rejects.toThrow("match");
        await expect(
            new PutCommandFileCommand({commandName: "Beta", content: command()}).execute()
        ).rejects.toThrow("match");
        await CommandFileStore.saveCommandFile(command());
        await expect(
            new PutCommandFileCommand({commandName: "alpha", content: command("alpha")}).execute()
        ).rejects.toThrow("occupied");
    });

    test("protects built-ins and allows only the controllable setting", async () => {
        const original = skill(
            "alpha",
            "built-in-skill: true\nbuilt-in-skill-user-controllable: true\ndisable-model-invocation: false\n"
        );
        await SkillStore.saveSkillFile(original);
        await expect(new DeleteSkillFileCommand({skillName: "alpha"}).execute()).rejects.toThrow(
            "cannot be deleted"
        );
        await expect(
            new PutSkillFileCommand({skillName: "alpha", content: original + "changed"}).execute()
        ).rejects.toThrow("read-only");
        const put = new PutSkillFileCommand({
            skillName: "alpha",
            content: original.replace("invocation: false", "invocation: true")
        });
        await put.execute();
        await roundTrip(put).revert();
        expect((await SkillStore.getSkill("alpha"))?.content).toBe(original);
        const builtCommand = command("Alpha", "built-in-command: true\n");
        await CommandFileStore.saveCommandFile(builtCommand);
        await expect(
            new DeleteCommandFileCommand({commandName: "Alpha"}).execute()
        ).rejects.toThrow("cannot be deleted");
        await expect(
            new PutCommandFileCommand({
                commandName: "Alpha",
                content: builtCommand + "edit"
            }).execute()
        ).rejects.toThrow("read-only");
        await expect(
            new PutCommandFileCommand({
                commandName: "Beta",
                content: command("Beta", "built-in-command: true\n")
            }).execute()
        ).rejects.toThrow("cannot create");
    });

    test("aggregates, copies, serializes, retains on undo and clears changedAssets", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new PutSkillFileCommand({skillName: "alpha", content: skill()}));
        tracker.addCommand(
            new PutSkillFileCommand({skillName: "alpha", content: skill("alpha", "", "edit")})
        );
        await tracker.execute();
        expect(tracker.getChangedAssets()).toHaveLength(1);
        const copy = tracker.getChangedAssets();
        copy.push("not-a-change");
        const restored = LogseqReversibleTransactionTrackerSerializer.deserialize(
            JSON.parse(
                JSON.stringify(LogseqReversibleTransactionTrackerSerializer.serialize(tracker))
            )
        );
        expect(restored.getChangedAssets()).toEqual(tracker.getChangedAssets());
        await restored.revertAppliedCommands();
        expect(restored.getChangedAssets()).toHaveLength(1);
        restored.clear();
        expect(restored.getChangedAssets()).toEqual([]);
        expect(
            LogseqReversibleTransactionTrackerSerializer.deserialize({
                commands: [],
                appliedCommandCount: 0,
                changedPages: []
            }).getChangedAssets()
        ).toEqual([]);
    });
});

describe("asset paths", () => {
    test.each([
        "assets/images/logo.png",
        "./assets/images/logo.png",
        "../assets/images/logo.png",
        "/graph/assets/images/logo.png"
    ])("canonicalizes %s", (input) => {
        expect(resolveGraphAssetPath(input, "/graph").graphRelativePath).toBe(
            "assets/images/logo.png"
        );
    });
    test("handles Windows drive paths", () => {
        expect(
            resolveGraphAssetPath("C:\\graph\\assets\\image.png", "C:\\graph").graphRelativePath
        ).toBe("assets/image.png");
    });
    test.each([
        "assets/../../secret",
        "/graph/assets-other/file",
        "https://example.com/a",
        "file:///graph/assets/a",
        "image.png",
        "assets/",
        "assets/../pages/a"
    ])("rejects %s", (input) => {
        expect(() => resolveGraphAssetPath(input, "/graph")).toThrow();
    });
});

describe("binary asset commands", () => {
    const files = new Map<string, Uint8Array>();
    let write: ReturnType<typeof vi.fn>;
    let action: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        files.clear();
        action = vi.fn(async ([name, first, second]: string[]) => {
            if (name === "stat") {
                const bytes = files.get(first);
                if (!bytes) throw new Error("ENOENT: no such file");
                return {size: bytes.length};
            }
            if (name === "unlink") {
                files.delete(second);
                return;
            }
            throw new Error(`Unexpected IPC ${name}`);
        });
        write = vi.fn(async (file: string, bytes: Uint8Array) => {
            files.set(`/graph/assets/${file}`, Uint8Array.from(bytes));
            return `/graph/assets/${file}`;
        });
        vi.stubGlobal("logseq", {
            ...logseq,
            App: {...logseq.App, getCurrentGraph: vi.fn().mockResolvedValue({path: "/graph"})}
        });
        vi.spyOn(WindowParentBridge, "getWindow").mockReturnValue({
            apis: {doAction: action},
            fetch: () => {}
        });
        vi.spyOn(WindowParentBridge, "getLogseqObject").mockReturnValue({
            api: {write_assetsdir_file: write}
        });
        vi.spyOn(WindowParentBridge, "makeAssetUrl").mockImplementation(
            async (value) => `/graph/${value}`
        );
        vi.spyOn(WindowParentBridge, "getFetch").mockReturnValue(
            vi.fn(async (url) => {
                const bytes = files.get(String(url));
                return {
                    ok: !!bytes,
                    status: bytes ? 200 : 404,
                    arrayBuffer: async () => bytes!.buffer
                } as Response;
            })
        );
    });
    test("decodes bytes, reads base64, and removes new assets on serialized undo", async () => {
        const put = new PutAssetFileCommand({
            assetPath: "/graph/assets/image.bin",
            contentBase64: "AP+A"
        });
        await put.execute();
        expect(Array.from(files.get("/graph/assets/image.bin")!)).toEqual([0, 255, 128]);
        expect(put.getChangedAssets()).toEqual(["assets/image.bin"]);
        expect(put.getChangedPages()).toEqual([]);
        expect(
            await new ReadAssetFileCommand({assetPath: "../assets/image.bin"}).execute()
        ).toEqual({exists: true, contentBase64: "AP+A"});
        await roundTrip(put).revert();
        expect(files.size).toBe(0);
    });
    test.each([
        new Uint8Array(),
        new Uint8Array([0, 255, 42])
    ])("restores existing bytes including zero-byte originals", async (bytes) => {
        files.set("/graph/assets/image.bin", bytes);
        const put = new PutAssetFileCommand({assetPath: "assets/image.bin", contentBase64: "AQ=="});
        await put.execute();
        await roundTrip(put).revert();
        expect(Buffer.from(files.get("/graph/assets/image.bin")!)).toEqual(Buffer.from(bytes));
    });
    test("does not mistake permission errors for missing originals", async () => {
        action.mockRejectedValueOnce(new Error("EACCES: permission denied"));
        await expect(
            new PutAssetFileCommand({assetPath: "assets/a", contentBase64: "AQ=="}).execute()
        ).rejects.toThrow("EACCES");
        expect(write).not.toHaveBeenCalled();
    });

    test("handles hosts that swallow stat errors without overwriting unreadable files", async () => {
        action.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
        expect(await new ReadAssetFileCommand({assetPath: "assets/missing"}).execute()).toEqual({
            exists: false,
            contentBase64: null
        });
        action.mockResolvedValueOnce(undefined).mockResolvedValueOnce(["/graph/assets/existing"]);
        await expect(
            new PutAssetFileCommand({assetPath: "assets/existing", contentBase64: "AQ=="}).execute()
        ).rejects.toThrow("metadata");
        expect(write).not.toHaveBeenCalled();
    });
    test("rolls back partially failed writes", async () => {
        files.set("/graph/assets/a", new Uint8Array([7]));
        write.mockImplementationOnce(async () => {
            files.set("/graph/assets/a", new Uint8Array([99]));
            throw new Error("write failed");
        });
        const put = new PutAssetFileCommand({assetPath: "assets/a", contentBase64: "AQ=="});
        await expect(put.execute()).rejects.toThrow("write failed");
        expect(Array.from(files.get("/graph/assets/a")!)).toEqual([7]);
        expect(put.getCommandState().status).toBe("new");
    });
    test("rejects malformed base64, web, protected storage and graph switches", async () => {
        expect(
            () => new PutAssetFileCommand({assetPath: "assets/a", contentBase64: " "})
        ).toThrow();
        expect(
            () => new PutAssetFileCommand({assetPath: "assets/a", contentBase64: "%%%"})
        ).toThrow();
        await expect(
            new PutAssetFileCommand({
                assetPath: `assets/storages/${logseq.baseInfo.id}/skills/a/SKILL.md`,
                contentBase64: "AQ=="
            }).execute()
        ).rejects.toThrow("dedicated commands");
        const put = new PutAssetFileCommand({assetPath: "assets/a", contentBase64: "AQ=="});
        await put.execute();
        vi.mocked(logseq.App.getCurrentGraph).mockResolvedValue({path: "/other"} as any);
        await expect(put.revert()).rejects.toThrow("graph changed");
        vi.mocked(WindowParentBridge.getWindow).mockReturnValue({});
        await expect(new ReadAssetFileCommand({assetPath: "assets/a"}).execute()).rejects.toThrow(
            "desktop host"
        );
    });
});
