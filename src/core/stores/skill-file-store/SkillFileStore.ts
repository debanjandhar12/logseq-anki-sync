import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import {parseSkillFile} from "../../skill-parser";
import type {SkillFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class SkillFileStore {
    static groupName: string = "skills";

    static getSkillFileName(skillFileData: Pick<SkillFileData, "name">): string {
        return `${skillFileData.name}.md`;
    }

    static getSkillFileNameFromContent(content: string): string {
        return SkillFileStore.getSkillFileName(parseSkillFile(content));
    }

    static async getSkillFile(fileName: string): Promise<SkillFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                SkillFileStore.groupName,
                fileName
            );
            return parseSkillFile(content);
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
                skillFiles.push(parseSkillFile(content));
            } catch (e) {
                logger.warn(`Failed to parse skill file ${fileName}:`, e);
            }
        }

        return skillFiles.sort((a, b) => a.name.localeCompare(b.name));
    }

    static async saveSkillFile(content: string): Promise<void> {
        const fileName = SkillFileStore.getSkillFileNameFromContent(content);

        await LogseqPluginStorageManager.saveFile(SkillFileStore.groupName, fileName, content);
    }

    static async deleteSkillFile(fileName: string): Promise<void> {
        try {
            await LogseqPluginStorageManager.deleteFile(SkillFileStore.groupName, fileName);
        } catch {}
    }
}
