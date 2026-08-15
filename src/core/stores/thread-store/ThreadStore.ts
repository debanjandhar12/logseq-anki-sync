import AsyncLock from "async-lock";
import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {ThreadFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export type ThreadUpdate<TResult> =
    | {type: "save"; threadData: ThreadFileData; result: TResult}
    | {type: "skip"; result: TResult};

export type ThreadUpdater<TResult> = (
    currentThread: ThreadFileData | null
) => ThreadUpdate<TResult> | Promise<ThreadUpdate<TResult>>;

/**
 * Store thread-related data along with some metadata
 */
export class ThreadStore {
    static groupName: string = "thread";
    private static readonly lock = new AsyncLock();

    static async loadThread(threadId: string): Promise<ThreadFileData | null> {
        const content = await LogseqPluginStorageManager.getFileContent(
            ThreadStore.groupName,
            threadId
        );
        if (content === undefined) return null;

        try {
            return JSON.parse(content) as ThreadFileData;
        } catch (error) {
            throw new Error(`Failed to parse thread data: ${threadId}`, {cause: error});
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
        threadFiles.sort((a, b) => getThreadUpdatedAt(b) - getThreadUpdatedAt(a));
        return threadFiles;
    }

    /**
     * Atomically updates one thread within this plugin instance. Updaters must not invoke another
     * ThreadStore mutation because these per-thread locks are intentionally non-reentrant.
     */
    static async updateThread<TResult>(
        threadId: string,
        updater: ThreadUpdater<TResult>
    ): Promise<TResult> {
        return await ThreadStore.lock.acquire(threadId, async () => {
            const currentThread = await ThreadStore.loadThread(threadId);
            const update = await updater(currentThread);
            if (update.type === "skip") return update.result;

            await LogseqPluginStorageManager.saveFile(
                ThreadStore.groupName,
                threadId,
                JSON.stringify(update.threadData)
            );
            return update.result;
        });
    }

    static async deleteThread(threadId: string): Promise<void> {
        await ThreadStore.lock.acquire(threadId, async () => {
            try {
                await LogseqPluginStorageManager.deleteFile(ThreadStore.groupName, threadId);
            } catch {}
        });
    }
}

// Utilities
const getThreadUpdatedAt = (threadData: ThreadFileData): number => {
    const updatedAt = threadData.custom.updatedAt;
    return updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
};
