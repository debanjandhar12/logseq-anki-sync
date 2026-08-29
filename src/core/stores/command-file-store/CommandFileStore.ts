import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import {parseCommandFile} from "../../command-parser";
import type {CommandFileData, StoredCommandFile} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export class CommandFileStore {
    static readonly groupName = "commands";

    static getCommandFileName(commandFileData: Pick<CommandFileData, "name">): string {
        return `${commandFileData.name}.md`;
    }

    static getCommandFileNameFromContent(content: string): string {
        return CommandFileStore.getCommandFileName(parseCommandFile(content));
    }

    static async getCommandFile(fileName: string): Promise<CommandFileData | null> {
        try {
            const content = await LogseqPluginStorageManager.getFileContent(
                CommandFileStore.groupName,
                fileName
            );
            return parseCommandFile(content);
        } catch (error) {
            logger.warn(`Failed to load command file ${fileName}:`, error);
            return null;
        }
    }

    static getCommandFileByName(name: string): Promise<CommandFileData | null> {
        return CommandFileStore.getCommandFile(CommandFileStore.getCommandFileName({name}));
    }

    static async getAllCommandFiles(): Promise<CommandFileData[]> {
        const storedFiles = await CommandFileStore.getAllStoredCommandFiles();
        return storedFiles.map(({commandFile}) => commandFile);
    }

    static async getAllStoredCommandFiles(): Promise<StoredCommandFile[]> {
        const fileNames = await LogseqPluginStorageManager.getFiles(CommandFileStore.groupName);
        const storedFiles: StoredCommandFile[] = [];

        for (const fileName of fileNames) {
            try {
                const content = await LogseqPluginStorageManager.getFileContent(
                    CommandFileStore.groupName,
                    fileName
                );
                storedFiles.push({fileName, commandFile: parseCommandFile(content)});
            } catch (error) {
                logger.warn(`Failed to load command file ${fileName}:`, error);
            }
        }

        return storedFiles.sort((left, right) =>
            left.commandFile.name.localeCompare(right.commandFile.name)
        );
    }

    static async saveCommandFile(content: string): Promise<void> {
        const fileName = CommandFileStore.getCommandFileNameFromContent(content);
        await LogseqPluginStorageManager.saveFile(CommandFileStore.groupName, fileName, content);
    }

    static async deleteCommandFile(fileName: string): Promise<void> {
        await LogseqPluginStorageManager.deleteFile(CommandFileStore.groupName, fileName);
    }
}
