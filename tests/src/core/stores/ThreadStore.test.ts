import {beforeEach, describe, expect, test, vi} from "vitest";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../../../src/core/stores/thread-store/types";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

function createThread(threadId: string): ThreadFileData {
    return {
        remoteId: threadId,
        status: "regular",
        custom: {
            createdAt: new Date(),
            updatedAt: new Date(),
            createdByPluginVersion: "test"
        }
    };
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
    let resolve: (() => void) | undefined;
    const promise = new Promise<void>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return {promise, resolve: () => resolve?.()};
}

describe("ThreadStore", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("thread-store-test");
    });

    test("serializes the complete update and gives the next updater the committed state", async () => {
        const firstUpdaterEntered = deferred();
        const releaseFirstUpdater = deferred();
        let secondUpdaterEntered = false;

        const first = ThreadStore.updateThread("thread-1", async (threadData) => {
            expect(threadData).toBeNull();
            firstUpdaterEntered.resolve();
            await releaseFirstUpdater.promise;
            return {
                type: "save" as const,
                threadData: {...createThread("thread-1"), title: "first"},
                result: "first-result"
            };
        });
        await firstUpdaterEntered.promise;

        const second = ThreadStore.updateThread("thread-1", (threadData) => {
            secondUpdaterEntered = true;
            expect(threadData?.title).toBe("first");
            return {
                type: "save",
                threadData: {...threadData!, status: "archived"},
                result: "second-result"
            };
        });
        await Promise.resolve();
        expect(secondUpdaterEntered).toBe(false);

        releaseFirstUpdater.resolve();
        await expect(first).resolves.toBe("first-result");
        await expect(second).resolves.toBe("second-result");
        await expect(ThreadStore.loadThread("thread-1")).resolves.toMatchObject({
            title: "first",
            status: "archived"
        });
    });

    test("allows different threads to update concurrently", async () => {
        const firstUpdaterEntered = deferred();
        const releaseFirstUpdater = deferred();

        const first = ThreadStore.updateThread("thread-1", async () => {
            firstUpdaterEntered.resolve();
            await releaseFirstUpdater.promise;
            return {type: "save", threadData: createThread("thread-1"), result: undefined};
        });
        await firstUpdaterEntered.promise;

        await expect(
            ThreadStore.updateThread("thread-2", () => ({
                type: "save",
                threadData: createThread("thread-2"),
                result: "completed"
            }))
        ).resolves.toBe("completed");

        releaseFirstUpdater.resolve();
        await first;
    });

    test("releases the lock after updater and storage failures", async () => {
        await expect(
            ThreadStore.updateThread("thread-1", () => {
                throw new Error("updater failed");
            })
        ).rejects.toThrow("updater failed");

        const store = LogseqPluginStorageManager.store;
        const setItem = vi.spyOn(store, "setItem").mockRejectedValueOnce(new Error("save failed"));
        await expect(
            ThreadStore.updateThread("thread-1", () => ({
                type: "save",
                threadData: createThread("thread-1"),
                result: undefined
            }))
        ).rejects.toThrow("save failed");
        setItem.mockRestore();

        await expect(
            ThreadStore.updateThread("thread-1", () => ({
                type: "save",
                threadData: createThread("thread-1"),
                result: "recovered"
            }))
        ).resolves.toBe("recovered");
    });

    test("does not overwrite corrupt thread data", async () => {
        await LogseqPluginStorageManager.store.setItem("thread/thread-1", "not-json");
        const updater = vi.fn();

        await expect(ThreadStore.updateThread("thread-1", updater)).rejects.toThrow(
            "Failed to parse thread data: thread-1"
        );
        expect(updater).not.toHaveBeenCalled();
        await expect(LogseqPluginStorageManager.store.getItem("thread/thread-1")).resolves.toBe(
            "not-json"
        );

        await expect(ThreadStore.deleteThread("thread-1")).resolves.toBeUndefined();
    });

    test("skip returns a result without writing", async () => {
        const setItem = vi.spyOn(LogseqPluginStorageManager.store, "setItem");

        await expect(
            ThreadStore.updateThread("missing", () => ({type: "skip", result: "unchanged"}))
        ).resolves.toBe("unchanged");
        expect(setItem).not.toHaveBeenCalled();
    });

    test("serializes deletion with updates to the same thread", async () => {
        const updateEntered = deferred();
        const releaseUpdate = deferred();
        const update = ThreadStore.updateThread("thread-1", async () => {
            updateEntered.resolve();
            await releaseUpdate.promise;
            return {
                type: "save" as const,
                threadData: createThread("thread-1"),
                result: undefined
            };
        });
        await updateEntered.promise;

        const deletion = ThreadStore.deleteThread("thread-1");
        releaseUpdate.resolve();
        await Promise.all([update, deletion]);

        await expect(ThreadStore.loadThread("thread-1")).resolves.toBeNull();
    });
});
