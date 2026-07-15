import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {LlamaCloudPdfPageData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class LlamaCloudPdfPageStore {
    static readonly groupName = "llama-cloud-pdf-pages";

    static async get(pageHash: string): Promise<LlamaCloudPdfPageData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                LlamaCloudPdfPageStore.groupName,
                LlamaCloudPdfPageStore.getFileName(pageHash)
            );
            const parsed = JSON.parse(content) as LlamaCloudPdfPageData;
            if (!LlamaCloudPdfPageStore.isValid(parsed)) {
                logger.warn(`Ignoring invalid cached LlamaCloud PDF page for ${pageHash}.`);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    static async save(pageHash: string, data: LlamaCloudPdfPageData): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            LlamaCloudPdfPageStore.groupName,
            LlamaCloudPdfPageStore.getFileName(pageHash),
            JSON.stringify(data)
        );
    }

    static async delete(pageHash: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(
                LlamaCloudPdfPageStore.groupName,
                LlamaCloudPdfPageStore.getFileName(pageHash)
            );
        } catch {}
    }

    private static getFileName(pageHash: string): string {
        return `${pageHash}.json`;
    }

    private static isValid(data: unknown): data is LlamaCloudPdfPageData {
        if (!data || typeof data !== "object") return false;
        const record = data as Record<string, unknown>;
        return (
            record.version === 1 &&
            Array.isArray(record.items) &&
            typeof record.content === "string"
        );
    }
}
