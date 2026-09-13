import {InMemoryStore} from "../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

export function createIsolatedPluginStorage(prefix: string) {
    const previous = LogseqPluginStorageManager.store;
    const store = new InMemoryStore(`${prefix}-${crypto.randomUUID()}`);
    LogseqPluginStorageManager.store = store;
    return {
        async snapshot() {
            const keys = (await store.allKeys()).sort();
            return Object.fromEntries(
                await Promise.all(keys.map(async (key) => [key, await store.getItem(key)]))
            );
        },
        async dispose() {
            try {
                await store.clear();
            } finally {
                LogseqPluginStorageManager.store = previous;
            }
        }
    };
}
