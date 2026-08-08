import "@logseq/libs";
import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";
import {WindowParentBridge} from "../WindowParentBridge";
import {StorageBackendFactory} from "./StorageBackendFactory";

/**
 * Static facade for plugin file storage operations.
 *
 * Backing store is selected at initialization time based on the runtime
 * environment (test, standalone/localStorage, or Logseq sandbox storage).
 */
export class LogseqPluginStorageManager {
    static store: IAsyncStorage = null;

    static async init() {
        LogseqPluginStorageManager.store = await StorageBackendFactory.createBackend();
    }

    static async getFiles(group: string) {
        LogseqPluginStorageManager.validateOperation(group);
        const allKeys = await LogseqPluginStorageManager.store.allKeys();
        const prefix = `${group}/`;
        return (
            allKeys
                ?.filter((key) => key.startsWith(prefix))
                .map((key) => key.slice(prefix.length)) || []
        );
    }

    static async getFileContent(group: string, fileName: string) {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.getItem(`${group}/${fileName}`);
    }

    static async saveFile(group: string, fileName: string, fileContent: string) {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.setItem(`${group}/${fileName}`, fileContent);
    }

    static async fileExists(group: string, fileName: string): Promise<boolean> {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.hasItem(`${group}/${fileName}`);
    }

    static async deleteFile(group: string, fileName: string) {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.removeItem(`${group}/${fileName}`);
    }

    static async getPluginStorageLocation(): Promise<string> {
        LogseqPluginStorageManager.validateOperation();

        return `${(await logseq.App.getCurrentGraph()).path}/assets/storages/${logseq.baseInfo.id}`;
    }

    static async openStorage() {
        LogseqPluginStorageManager.validateOperation();

        try {
            const storageLocation = await LogseqPluginStorageManager.getPluginStorageLocation();
            WindowParentBridge.openPath(storageLocation);
        } catch (error) {
            await logseq.UI.showMsg("Failed to access plugin storage.", "error");
            throw error;
        }
    }

    private static validateOperation(group?: string, fileName?: string) {
        if (LogseqPluginStorageManager.store == null)
            throw new Error("LogseqPluginStorageManager not initialized");
        if (group?.includes("/")) throw new Error("Group name cannot contain slash: " + group);
        if (fileName?.includes("/")) throw new Error("File name cannot contain slash: " + fileName);
    }
}
