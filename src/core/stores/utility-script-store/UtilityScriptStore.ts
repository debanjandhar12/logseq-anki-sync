import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";

const SCRIPT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.js$/;

export class UtilityScriptStore {
    static readonly groupName = "utility-scripts";

    private static assertValidName(name: string): void {
        if (!SCRIPT_NAME_PATTERN.test(name)) {
            throw new Error(`Invalid utility script name: ${JSON.stringify(name)}`);
        }
    }

    static getScript(name: string): Promise<string | undefined> {
        UtilityScriptStore.assertValidName(name);
        return LogseqPluginStorageManager.getFileContent(UtilityScriptStore.groupName, name);
    }

    static getScripts(): Promise<string[]> {
        return LogseqPluginStorageManager.getFiles(UtilityScriptStore.groupName);
    }

    static saveScript(name: string, content: string): Promise<void> {
        UtilityScriptStore.assertValidName(name);
        return LogseqPluginStorageManager.saveFile(UtilityScriptStore.groupName, name, content);
    }
}
