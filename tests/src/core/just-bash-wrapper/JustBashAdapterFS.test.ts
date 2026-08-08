import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {JustBashAdapterFS} from "../../../../src/core/just-bash-wrapper";
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
    });

    test("registers tool-results read-only under the sandbox home", () => {
        const mount = JustBashAdapterFS.getMountConfigs().find(
            ({mountPoint}) => mountPoint === "/home/user/tool-results"
        );
        expect(mount).toBeDefined();
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
});
