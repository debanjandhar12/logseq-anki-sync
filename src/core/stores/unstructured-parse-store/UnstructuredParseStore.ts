import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {UnstructuredParseData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class UnstructuredParseStore {
    static readonly groupName = "unstructured-parses";

    static async get(pageHash: string): Promise<UnstructuredParseData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                UnstructuredParseStore.groupName,
                UnstructuredParseStore.getFileName(pageHash)
            );
            const parsed = JSON.parse(content) as UnstructuredParseData;
            if (!UnstructuredParseStore.isValid(parsed)) {
                logger.warn(`Ignoring invalid cached PDF parse for ${pageHash}.`);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    static async save(pageHash: string, data: UnstructuredParseData): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            UnstructuredParseStore.groupName,
            UnstructuredParseStore.getFileName(pageHash),
            JSON.stringify(data)
        );
    }

    static async delete(pageHash: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(
                UnstructuredParseStore.groupName,
                UnstructuredParseStore.getFileName(pageHash)
            );
        } catch {}
    }

    private static getFileName(pageHash: string): string {
        return `${pageHash}.json`;
    }

    private static isValid(data: unknown): data is UnstructuredParseData {
        if (!data || typeof data !== "object") return false;
        const record = data as Record<string, unknown>;
        return (
            record.version === 1 &&
            Array.isArray(record.elements) &&
            typeof record.content === "string"
        );
    }
}
