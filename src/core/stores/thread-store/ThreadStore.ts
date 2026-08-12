import AwaitLock from "await-lock";
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

interface ThreadLockEntry {
    lock: AwaitLock;
    users: number;
}

/**
 * Store thread-related data along with some metadata
 */
export class ThreadStore {
    static groupName: string = "thread";
    private static readonly threadLocks = new Map<string, ThreadLockEntry>();

    static async loadRawThread(threadId: string): Promise<string> {
        const content = await LogseqPluginStorageManager.getFileContent(
            ThreadStore.groupName,
            threadId
        );
        if (typeof content !== "string") {
            throw new Error(`Thread data not found: ${threadId}`);
        }
        return content;
    }

    static async loadThread(threadId: string): Promise<ThreadFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                ThreadStore.groupName,
                threadId
            );
            return JSON.parse(content) as ThreadFileData;
        } catch {
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
        return await ThreadStore.runSerialized(threadId, async () => {
            const currentThread = await ThreadStore.loadThreadForMutation(threadId);
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
        await ThreadStore.runSerialized(threadId, async () => {
            try {
                await LogseqPluginStorageManager.deleteFile(ThreadStore.groupName, threadId);
            } catch {}
        });
    }

    private static async loadThreadForMutation(threadId: string): Promise<ThreadFileData | null> {
        let content: unknown;
        try {
            content = await LogseqPluginStorageManager.getFileContent(
                ThreadStore.groupName,
                threadId
            );
        } catch (error) {
            if (isMissingFileError(error)) return null;
            throw error;
        }
        if (content == null) return null;
        if (typeof content !== "string") {
            throw new Error(`Invalid thread data: ${threadId}`);
        }

        try {
            return JSON.parse(content) as ThreadFileData;
        } catch (error) {
            throw new Error(`Failed to parse thread data: ${threadId}`, {cause: error});
        }
    }

    private static async runSerialized<TResult>(
        threadId: string,
        operation: () => Promise<TResult>
    ): Promise<TResult> {
        let entry = ThreadStore.threadLocks.get(threadId);
        if (!entry) {
            entry = {lock: new AwaitLock(), users: 0};
            ThreadStore.threadLocks.set(threadId, entry);
        }
        entry.users += 1;

        let acquired = false;
        try {
            await entry.lock.acquireAsync();
            acquired = true;
            return await operation();
        } finally {
            if (acquired) entry.lock.release();
            entry.users -= 1;
            if (entry.users === 0 && ThreadStore.threadLocks.get(threadId) === entry) {
                ThreadStore.threadLocks.delete(threadId);
            }
        }
    }
}

function isMissingFileError(error: unknown): boolean {
    return error instanceof Error && error.message.toLowerCase().includes("file not existed");
}

// Utilities
const getThreadUpdatedAt = (threadData: ThreadFileData): number => {
    const updatedAt = threadData.custom.updatedAt;
    return updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
};
