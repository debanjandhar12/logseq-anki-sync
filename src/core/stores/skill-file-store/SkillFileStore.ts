import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import {parseSkillFile} from "../../skill-parser/parseSkillFile";
import type {SkillFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class SkillFileStore {
    static groupName: string = "skills";

    static getSkillFileName(skillFileData: Pick<SkillFileData, "name">): string {
        return `${skillFileData.name}.md`;
    }

    static async getSkillFile(fileName: string): Promise<SkillFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                SkillFileStore.groupName,
                fileName
            );
            if (content === undefined) return null;
            return parseSkillFile(content);
        } catch {
            return null;
        }
    }

    static skillFileExists(fileName: string): Promise<boolean> {
        return LogseqPluginStorageManager.fileExists(SkillFileStore.groupName, fileName);
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

        return skillFiles.sort(
            (left, right) =>
                Number(right.builtInSkill === true) - Number(left.builtInSkill === true) ||
                left.name.localeCompare(right.name)
        );
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
    private static getSkillFileNameFromContent(content: string): string {
        return SkillFileStore.getSkillFileName(parseSkillFile(content));
    }
}
