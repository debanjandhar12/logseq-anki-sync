import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {ThreadFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

/**
 * Store thread-related data along with some metadata
 */
export class ThreadStore {
    static groupName: string = "thread";

    static async loadThread(threadId: string): Promise<ThreadFileData> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                ThreadStore.groupName,
                threadId
            );
            return JSON.parse(content) as ThreadFileData;
        } catch (e) {
            return null;
        }
    }

    static async listThreads(): Promise<ThreadFileData[]> {
        const fileNames = await LogseqPluginStorageManager.getFiles(ThreadStore.groupName);
        const threadFiles = [];
        for (const fileName of fileNames) {
            const content = await LogseqPluginStorageManager.getFileContent(
                ThreadStore.groupName,
                fileName
            );
            try {
                threadFiles.push(JSON.parse(content) as ThreadFileData);
            } catch (e) {
                logger.warn(`Failed to parse thread file ${fileName}:`, e);
            }
        }
        threadFiles.sort((a, b) => b.custom.updatedAt - a.custom.updatedAt);
        return threadFiles;
    }

    static async saveThread(threadId: string, threadData: ThreadFileData): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            ThreadStore.groupName,
            threadId,
            JSON.stringify(threadData)
        );
    }

    static async deleteThread(threadId: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(ThreadStore.groupName, threadId);
        } catch (e) {}
    }
}
