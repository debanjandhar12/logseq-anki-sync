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

    static async deleteFile(group: string, fileName: string) {
        return await LogseqPluginStorageManager.store.removeItem(`${group}/${fileName}`);
    }

    static async openStorage() {
        LogseqPluginStorageManager.validateOperation();

        try {
            console.log(await logseq.Assets.listFilesOfCurrentGraph());
            // TBU: figure out how to open storage
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
