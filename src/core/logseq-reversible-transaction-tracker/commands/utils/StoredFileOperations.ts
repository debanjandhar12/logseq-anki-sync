import {CommandFileStore} from "src/core/stores/command-file-store/CommandFileStore";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {LogseqPluginStorageManager as Storage} from "src/logseq/LogseqPluginStorageManager";
import {assertRelativeStoragePath} from "src/logseq/LogseqPluginStorageManager/relativeStoragePath";

/** Shared raw reads and storage identity helpers; persistence remains in the stores. */
export class StoredFileOperations {
    public static async readSkillContent(name: string): Promise<string | undefined> {
        return Storage.getFileContent(`${SkillStore.groupName}/${name}`, "SKILL.md");
    }

    public static async readCommandContent(name: string): Promise<string | undefined> {
        return Storage.getFileContent(
            CommandFileStore.groupName,
            CommandFileStore.getCommandFileName({name})
        );
    }

    public static getGraphRelativePath(relativePath: string): string {
        assertRelativeStoragePath(logseq.baseInfo.id);
        assertRelativeStoragePath(relativePath);
        return `assets/storages/${logseq.baseInfo.id}/${relativePath}`;
    }

    /** Match the editor's case-insensitive command identity rules without hiding malformed files. */
    public static async assertCommandDestinationAvailable(name: string): Promise<void> {
        const fileName = CommandFileStore.getCommandFileName({name});
        const files = await Storage.getFiles(CommandFileStore.groupName);
        if (
            files.some(
                (file) =>
                    file !== fileName && file.toLocaleLowerCase() === fileName.toLocaleLowerCase()
            )
        )
            throw new Error(`Command destination is occupied: ${name}`);
    }
}
