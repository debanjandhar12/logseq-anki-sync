import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {LlamaCloudParseResultData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class LlamaCloudParseResultStore {
    static readonly groupName = "llama-cloud-parse-results";

    static async get(pageHash: string): Promise<LlamaCloudParseResultData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                LlamaCloudParseResultStore.groupName,
                LlamaCloudParseResultStore.getFileName(pageHash)
            );
            const parsed = JSON.parse(content) as LlamaCloudParseResultData;
            if (!LlamaCloudParseResultStore.isValid(parsed)) {
                logger.warn(`Ignoring invalid cached LlamaCloud parse result for ${pageHash}.`);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    static async save(pageHash: string, data: LlamaCloudParseResultData): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            LlamaCloudParseResultStore.groupName,
            LlamaCloudParseResultStore.getFileName(pageHash),
            JSON.stringify(data)
        );
    }

    static async delete(pageHash: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(
                LlamaCloudParseResultStore.groupName,
                LlamaCloudParseResultStore.getFileName(pageHash)
            );
        } catch {}
    }

    private static getFileName(pageHash: string): string {
        return `${pageHash}.json`;
    }

    private static isValid(data: unknown): data is LlamaCloudParseResultData {
        if (!data || typeof data !== "object") return false;
        const record = data as Record<string, unknown>;
        return (
            record.version === 1 &&
            Array.isArray(record.items) &&
            typeof record.content === "string"
        );
    }
}
