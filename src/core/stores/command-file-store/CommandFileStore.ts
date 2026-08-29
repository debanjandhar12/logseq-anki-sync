import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import {parseCommandFile} from "../../command-parser";
import type {CommandFileData} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class CommandFileStore {
    public static readonly groupName = "commands";

    public static getCommandFileName(commandFileData: Pick<CommandFileData, "name">): string {
        return `${commandFileData.name}.md`;
    }

    static async getCommandFile(fileName: string): Promise<CommandFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                CommandFileStore.groupName,
                fileName
            );
            if (content === undefined) return null;
            return parseCommandFile(content);
        } catch (error) {
            logger.warn(`Failed to load command file ${fileName}:`, error);
            return null;
        }
    }

    static getCommandFileByName(name: string): Promise<CommandFileData | null> {
        return CommandFileStore.getCommandFile(CommandFileStore.getCommandFileName({name}));
    }

    static commandFileExists(fileName: string): Promise<boolean> {
        return LogseqPluginStorageManager.fileExists(CommandFileStore.groupName, fileName);
    }

    static async getAllCommandFiles(): Promise<CommandFileData[]> {
        const fileNames = await LogseqPluginStorageManager.getFiles(CommandFileStore.groupName);
        const commandFiles: CommandFileData[] = [];

        for (const fileName of fileNames) {
            try {
                const content = await LogseqPluginStorageManager.getFileContent(
                    CommandFileStore.groupName,
                    fileName
                );
                commandFiles.push(parseCommandFile(content));
            } catch (error) {
                logger.warn(`Failed to load command file ${fileName}:`, error);
            }
        }

        return commandFiles.sort((left, right) => left.name.localeCompare(right.name));
    }

    static async saveCommandFile(content: string): Promise<void> {
        const fileName = CommandFileStore.getCommandFileNameFromContent(content);
        await LogseqPluginStorageManager.saveFile(CommandFileStore.groupName, fileName, content);
    }

    static async deleteCommandFile(fileName: string): Promise<void> {
        await LogseqPluginStorageManager.deleteFile(CommandFileStore.groupName, fileName);
    }

    private static getCommandFileNameFromContent(content: string): string {
        return CommandFileStore.getCommandFileName(parseCommandFile(content));
    }
}
