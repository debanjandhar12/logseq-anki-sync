export class LogseqPluginStorageManager {
    static store = null;

    static init() {
        LogseqPluginStorageManager.store = logseq.Assets.makeSandboxStorage();
    }

    static async getFiles(group) {
        return await LogseqPluginStorageManager.store.getAllKeys().filter(key => key.startsWith(group));
    }

    static async getFileContent(group, fileName) {
        await LogseqPluginStorageManager.store.getItem(`${group}_${fileName}`);
    }

    static async saveFile(group, fileName, fileContent) {
        await LogseqPluginStorageManager.store.setItem(`${group}_${fileName}`, fileContent);
    }
}