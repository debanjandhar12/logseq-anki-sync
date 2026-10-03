import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";
import {describe, expect, test, vi} from "vitest";
import {InMemoryStore} from "../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LocalStorageStore} from "../../../src/logseq/LogseqPluginStorageManager/LocalStorageStore";
import {LogseqPluginStorageManager} from "../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

describe("LogseqPluginStorageManager", () => {
    test.each([
        "memory",
        "localStorage",
        "sandbox"
    ])("nested storage roundtrip on %s backend", async (backend) => {
        const memory = new InMemoryStore(`nested-${backend}`);
        LogseqPluginStorageManager.store =
            backend === "localStorage"
                ? new LocalStorageStore("nested-conformance")
                : backend === "sandbox"
                  ? {
                        getItem: async (key: string) => {
                            const value = await memory.getItem(key);
                            if (value === undefined) throw new Error(`File not existed: ${key}`);
                            return value;
                        },
                        setItem: (key: string, value: string) => memory.setItem(key, value),
                        allKeys: () => memory.allKeys(),
                        hasItem: (key: string) => memory.hasItem(key),
                        removeItem: (key: string) => memory.removeItem(key),
                        clear: () => memory.clear()
                    }
                  : memory;
        await LogseqPluginStorageManager.store.clear();
        await LogseqPluginStorageManager.saveFile(
            "skills/foo",
            "references/nested/Hello 世界.md",
            "hello"
        );
        await LogseqPluginStorageManager.saveFile("skills/foobar", "SKILL.md", "other");
        await LogseqPluginStorageManager.saveFile("commands", "Legacy name.md", "flat");
        expect(await LogseqPluginStorageManager.getFiles("skills/foo")).toEqual([
            "references/nested/Hello 世界.md"
        ]);
        expect(
            await LogseqPluginStorageManager.getFileContent(
                "skills/foo",
                "references/nested/Hello 世界.md"
            )
        ).toBe("hello");
        expect(
            await LogseqPluginStorageManager.fileExists(
                "skills/foo",
                "references/nested/Hello 世界.md"
            )
        ).toBe(true);
        expect(await LogseqPluginStorageManager.getFileContent("commands", "Legacy name.md")).toBe(
            "flat"
        );
        await LogseqPluginStorageManager.deleteFile(
            "skills/foo",
            "references/nested/Hello 世界.md"
        );
        expect(
            await LogseqPluginStorageManager.getFileContent(
                "skills/foo",
                "references/nested/Hello 世界.md"
            )
        ).toBeUndefined();
        await LogseqPluginStorageManager.store.clear();
    });

    test.each([
        "",
        "/absolute",
        "trailing/",
        "a//b",
        ".",
        "..",
        "a/../b",
        "a/./b",
        "a\\b",
        "C:drive",
        "a\0b",
        "a\nb",
        "a\u007fb"
    ])("rejects raw unsafe path %j for every operation", async (path) => {
        const backend = new InMemoryStore("unsafe-paths");
        LogseqPluginStorageManager.store = backend;
        await expect(LogseqPluginStorageManager.getFiles(path)).rejects.toThrow(
            /Invalid relative storage path/
        );
        await expect(LogseqPluginStorageManager.saveFile("safe", path, "content")).rejects.toThrow(
            /Invalid relative storage path/
        );
        await expect(LogseqPluginStorageManager.getFileContent("safe", path)).rejects.toThrow(
            /Invalid relative storage path/
        );
        await expect(LogseqPluginStorageManager.fileExists("safe", path)).rejects.toThrow(
            /Invalid relative storage path/
        );
        await expect(LogseqPluginStorageManager.deleteFile("safe", path)).rejects.toThrow(
            /Invalid relative storage path/
        );
        expect(await backend.allKeys()).toEqual([]);
    });

    test("keeps encoded characters opaque", async () => {
        LogseqPluginStorageManager.store = new InMemoryStore("encoded-path");
        await LogseqPluginStorageManager.saveFile("files", "%2e%2e%2ffile", "opaque");
        expect(await LogseqPluginStorageManager.getFiles("files")).toEqual(["%2e%2e%2ffile"]);
    });
    test("normalizes the sandbox missing-file error to undefined", async () => {
        LogseqPluginStorageManager.store = {
            getItem: vi.fn().mockRejectedValue(new Error("File not existed: thread/missing"))
        } as unknown as IAsyncStorage;

        await expect(
            LogseqPluginStorageManager.getFileContent("thread", "missing")
        ).resolves.toBeUndefined();
    });

    test("propagates unrelated storage errors", async () => {
        const error = new Error("storage unavailable");
        LogseqPluginStorageManager.store = {
            getItem: vi.fn().mockRejectedValue(error)
        } as unknown as IAsyncStorage;

        await expect(LogseqPluginStorageManager.getFileContent("thread", "missing")).rejects.toBe(
            error
        );
    });
});
