import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {JustBashAdapterFS} from "../../../../src/core/just-bash-wrapper";
import {AnyDocParseResultStore} from "../../../../src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {ToolResultStore} from "../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

describe("JustBashAdapterFS", () => {
    beforeAll(() => {
        LogseqPluginStorageManager.store = new InMemoryStore("just-bash-adapter-test");
    });

    beforeEach(async () => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("just-bash-adapter-test");
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            "call-1_web_search.json",
            '{"ok":true}'
        );
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            `${"a".repeat(64)}-page-1.md`,
            "parsed"
        );
    });

    test("registers tool-results read-only under the sandbox home", () => {
        const mount = JustBashAdapterFS.getMountConfigs().find(
            ({mountPoint}) => mountPoint === "/home/user/tool-results"
        );
        expect(mount).toBeDefined();
        expect(
            JustBashAdapterFS.getMountConfigs().find(
                ({mountPoint}) => mountPoint === "/home/user/anydoc-parse-results"
            )
        ).toBeDefined();
    });

    test("rejects invalid mount folder names", () => {
        expect(() => JustBashAdapterFS.addLogseqPluginFolder("a/b", "read")).toThrow(
            /Invalid Logseq plugin folder name/
        );
    });

    test("reads stored files through the filesystem interface", async () => {
        const fs = new JustBashAdapterFS(ToolResultStore.groupName, "read");

        await expect(fs.readFile("/call-1_web_search.json")).resolves.toBe('{"ok":true}');
        await expect(fs.exists("/call-1_web_search.json")).resolves.toBe(true);
        await expect(fs.exists("/missing.json")).resolves.toBe(false);
        await expect(fs.readdir("/")).resolves.toContain("call-1_web_search.json");
        expect((await fs.stat("/call-1_web_search.json")).isFile).toBe(true);
        expect((await fs.stat("/")).isDirectory).toBe(true);
    });

    test("rejects writes when mounted with read permission", async () => {
        const fs = new JustBashAdapterFS(ToolResultStore.groupName, "read");

        await expect(fs.writeFile("/x.json", "1")).rejects.toThrow(/EROFS/);
        await expect(fs.appendFile("/x.json", "1")).rejects.toThrow(/EROFS/);
        await expect(fs.rm("/call-1_web_search.json")).rejects.toThrow(/EROFS/);
        await expect(fs.chmod("/call-1_web_search.json", 0o600)).rejects.toThrow(/EROFS/);
        await expect(fs.utimes("/call-1_web_search.json", new Date(), new Date())).rejects.toThrow(
            /EROFS/
        );
    });

    test("persists read-write operations through plugin storage", async () => {
        const fs = new JustBashAdapterFS("scratch", "readwrite");

        await fs.writeFile("/a.txt", "a");
        await fs.appendFile("/a.txt", "b");
        await expect(LogseqPluginStorageManager.getFileContent("scratch", "a.txt")).resolves.toBe(
            "ab"
        );
        await fs.mv("/a.txt", "/b.txt");
        await expect(fs.exists("/a.txt")).resolves.toBe(false);
        await expect(fs.readFile("/b.txt")).resolves.toBe("ab");
        await fs.rm("/b.txt");
        await expect(fs.exists("/b.txt")).resolves.toBe(false);
    });

    test("infers nested directories and immediate typed children", async () => {
        await LogseqPluginStorageManager.saveFile("nested", "example/references/info.md", "世界");
        await LogseqPluginStorageManager.saveFile("nested", "example/SKILL.md", "skill");
        const fs = new JustBashAdapterFS("nested", "read");
        await fs.refresh();
        expect(fs.getAllPaths()).toEqual([
            "/",
            "/example",
            "/example/SKILL.md",
            "/example/references",
            "/example/references/info.md"
        ]);
        expect(await fs.readdir("/")).toEqual(["example"]);
        expect(await fs.readdirWithFileTypes("/example")).toEqual([
            {name: "SKILL.md", isFile: true, isDirectory: false, isSymbolicLink: false},
            {name: "references", isFile: false, isDirectory: true, isSymbolicLink: false}
        ]);
        expect((await fs.stat("/example/references")).isDirectory).toBe(true);
        expect((await fs.stat("/example/references/info.md")).size).toBe(6);
        expect(await fs.realpath("/example/./references")).toBe("/example/references");
        await expect(fs.readFile("/example")).rejects.toThrow(/EISDIR/);
        await expect(fs.readdir("/missing")).rejects.toThrow(/ENOENT/);
        await expect(fs.readdir("/example/SKILL.md")).rejects.toThrow(/ENOTDIR/);
        await expect(fs.exists("/example/SKILL.md/child")).resolves.toBe(false);
        await expect(fs.readFile("/example/SKILL.md/child")).rejects.toThrow(/ENOTDIR/);
    });

    test("supports nested mkdir, write, append, copy, move and recursive removal", async () => {
        const fs = new JustBashAdapterFS("nested-write", "readwrite");
        await expect(fs.writeFile("/absent/file", "text")).rejects.toThrow(/ENOENT/);
        await expect(fs.mkdir("/absent/child")).rejects.toThrow(/ENOENT/);
        await fs.mkdir("/source/nested/empty", {recursive: true});
        await fs.writeFile("/source/nested/file", "a");
        await fs.appendFile("/source/nested/file", "b");
        await expect(fs.mkdir("/source/nested/file/child", {recursive: true})).rejects.toThrow(
            /ENOTDIR/
        );
        await expect(fs.writeFile("/source/nested", "file")).rejects.toThrow(/EISDIR/);
        await expect(fs.cp("/source", "/copy")).rejects.toThrow(/EISDIR/);
        await expect(fs.cp("/source", "/source/child", {recursive: true})).rejects.toThrow(
            /EINVAL/
        );
        await fs.cp("/source", "/copy", {recursive: true});
        expect(await fs.readFile("/copy/nested/file")).toBe("ab");
        expect(await fs.exists("/copy/nested/empty")).toBe(true);
        await fs.mv("/copy", "/moved");
        expect(await fs.exists("/copy")).toBe(false);
        expect(await fs.readFile("/moved/nested/file")).toBe("ab");
        await expect(fs.mv("/source", "/moved")).rejects.toThrow(/ENOTEMPTY/);
        await expect(fs.rm("/moved")).rejects.toThrow(/ENOTEMPTY/);
        await fs.rm("/moved", {recursive: true});
        expect(await fs.exists("/moved")).toBe(false);
        await fs.rm("/source/nested/file");
        expect(await fs.exists("/source/nested")).toBe(true);
        await fs.rm("/", {recursive: true});
        expect(await fs.readdir("/")).toEqual([]);
        await fs.rm("/missing", {force: true});
    });

    test("empty directories are ephemeral and malformed trees fail instead of masquerading as files", async () => {
        const fs = new JustBashAdapterFS("ephemeral", "readwrite");
        await fs.mkdir("/empty", {recursive: true});
        expect(await fs.exists("/empty")).toBe(true);
        expect(await new JustBashAdapterFS("ephemeral", "readwrite").exists("/empty")).toBe(false);
        await LogseqPluginStorageManager.saveFile("ephemeral", "file", "text");
        await LogseqPluginStorageManager.saveFile("ephemeral", "file/child", "collision");
        await expect(fs.refresh()).rejects.toThrow(/collision/);
    });

    test("skills mount denies all nested mutation operations", async () => {
        await LogseqPluginStorageManager.saveFile("skills/example", "SKILL.md", "skill");
        const mount = JustBashAdapterFS.getMountConfigs().find(
            ({mountPoint}) => mountPoint === "/home/user/skills"
        );
        expect(mount).toBeDefined();
        const fs = mount!.filesystem;
        expect(await fs.readFile("/example/SKILL.md")).toBe("skill");
        await expect(fs.mkdir("/example/scripts", {recursive: true})).rejects.toThrow(/EROFS/);
        await expect(fs.cp("/example", "/other", {recursive: true})).rejects.toThrow(/EROFS/);
        await expect(fs.mv("/example", "/other")).rejects.toThrow(/EROFS/);
        await expect(fs.rm("/example", {recursive: true})).rejects.toThrow(/EROFS/);
        await expect(fs.writeFile("/example/new", "text")).rejects.toThrow(/EROFS/);
    });
});
