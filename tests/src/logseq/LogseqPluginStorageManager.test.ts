import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";
import {describe, expect, test, vi} from "vitest";
import {LogseqPluginStorageManager} from "../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

describe("LogseqPluginStorageManager", () => {
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
