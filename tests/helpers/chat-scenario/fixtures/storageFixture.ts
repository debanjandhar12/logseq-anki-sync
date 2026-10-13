import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../../../src/core/stores/thread-store/types";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

export function createStorageFixture() {
    const previous = LogseqPluginStorageManager.store;
    const store = new InMemoryStore(`chat-scenario-${crypto.randomUUID()}`);
    LogseqPluginStorageManager.store = store;
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
                await store.clear();
            } finally {
                LogseqPluginStorageManager.store = previous;
            }
        }
    };
}
export type StorageFixture = ReturnType<typeof createStorageFixture>;
