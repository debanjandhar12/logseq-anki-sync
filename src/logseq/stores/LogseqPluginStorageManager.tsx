import "@logseq/libs";
import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";

/**
 * TBU: This should be synchronization safe..
 */
export class LogseqPluginStorageManager {
    static store: IAsyncStorage = null;

    static init() {
        LogseqPluginStorageManager.store = logseq.Assets.makeSandboxStorage();
    }

    static async getFiles(group: string) {
        LogseqPluginStorageManager.validateOperation(group);
        return (await LogseqPluginStorageManager.store.allKeys()).filter((key) =>
            key.startsWith(group)
        );
    }

    static async getFileContent(group: string, fileName: string) {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.getItem(`${group}_${fileName}`);
    }

    static async saveFile(group: string, fileName: string, fileContent: string) {
        LogseqPluginStorageManager.validateOperation(group, fileName);
        return await LogseqPluginStorageManager.store.setItem(`${group}_${fileName}`, fileContent);
    }

    static async deleteFile(group: string, fileName: string) {
        return await LogseqPluginStorageManager.store.removeItem(`${group}_${fileName}`);
    }

    private static validateOperation(group?: string, fileName?: string) {
        if (LogseqPluginStorageManager.store == null)
            throw new Error("LogseqPluginStorageManager not initialized");
        if (group?.includes("_")) throw new Error("Group name cannot contain underscore");
        if (fileName?.includes("_")) throw new Error("File name cannot contain underscore");
    }
}
