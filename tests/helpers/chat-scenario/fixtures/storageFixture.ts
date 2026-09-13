import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../../../src/core/stores/thread-store/types";
import {createIsolatedPluginStorage} from "../../createIsolatedPluginStorage";

export function createStorageFixture() {
    const storage = createIsolatedPluginStorage("chat-scenario");
    return {
        async seedThread(thread: ThreadFileData) {
            await ThreadStore.updateThread(thread.remoteId, () => ({
                type: "save",
                threadData: structuredClone(thread),
                result: undefined
            }));
        },
        async dispose() {
            try {
                // Wait for queued history/title writes before restoring the backing store.
                for (const thread of await ThreadStore.listThreads()) {
                    await ThreadStore.updateThread(thread.remoteId, () => ({
                        type: "skip",
                        result: undefined
                    }));
                }
            } finally {
                await storage.dispose();
            }
        }
    };
}
export type StorageFixture = ReturnType<typeof createStorageFixture>;
