import "@logseq/libs";
import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";
import {LogseqAppInfoFetcher} from "../LogseqAppInfoFetcher";
import {InMemoryStore} from "./InMemoryStore";
import {LocalStorageStore} from "./LocalStorageStore";

/**
 * Factory responsible for creating the appropriate storage backend
 * based on the current runtime environment.
 */
export class StorageBackendFactory {
    /**
     * Resolve the storage namespace for the current Logseq graph.
     */
    static async getStorageNamespace(): Promise<string> {
        const currentGraph = await logseq.App.getCurrentGraph();
        return `${logseq.baseInfo.id}:${currentGraph?.name ?? "unknown-graph"}`;
    }

    /**
     * Creates the storage backend appropriate for the current environment.
     * - InMemoryStore during tests
     * - LocalStorageStore when Logseq host access is unavailable
     * - Logseq sandbox storage otherwise
     */
    static async createBackend(): Promise<IAsyncStorage> {
        if (process.env.NODE_ENV === "test") {
            return new InMemoryStore(await StorageBackendFactory.getStorageNamespace());
        }

        if (!LogseqAppInfoFetcher.checkHostAccess()) {
            return new LocalStorageStore(await StorageBackendFactory.getStorageNamespace());
        }

        return logseq.Assets.makeSandboxStorage() as IAsyncStorage;
    }
}
