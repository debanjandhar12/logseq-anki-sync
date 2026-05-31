import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {SkillFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class SkillFileStore {
    static groupName: string = "skill-file";

    static async getSkillFile(fileName: string): Promise<SkillFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                SkillFileStore.groupName,
                fileName
            );
            return JSON.parse(content) as SkillFileData;
        } catch {
            return null;
        }
    }

    static async getAllSkillFile(): Promise<SkillFileData[]> {
        const fileNames = await LogseqPluginStorageManager.getFiles(SkillFileStore.groupName);
        const skillFiles = [];

        for (const fileName of fileNames) {
            const content = await LogseqPluginStorageManager.getFileContent(
                SkillFileStore.groupName,
                fileName
            );
            try {
                skillFiles.push(JSON.parse(content) as SkillFileData);
            } catch (e) {
                logger.warn(`Failed to parse skill file ${fileName}:`, e);
            }
        }

        return skillFiles.sort((a, b) => a.name.localeCompare(b.name));
    }

    static async saveSkillFile(fileName: string, skillFileData: SkillFileData): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            SkillFileStore.groupName,
            fileName,
            JSON.stringify(skillFileData)
        );
    }

    static async deleteSkillFile(fileName: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(SkillFileStore.groupName, fileName);
        } catch {}
    }
}
