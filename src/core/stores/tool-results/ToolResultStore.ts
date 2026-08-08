import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {ToolResultValue} from "./types";

export class ToolResultStore {
    static readonly groupName = "tool-results";

    static async storeToolResult(
        toolCallId: string,
        toolName: string,
        result: ToolResultValue
    ): Promise<string> {
        const fileName = ToolResultStore.getFileName(toolCallId, toolName);
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            fileName,
            JSON.stringify(result)
        );
        return fileName;
    }

    private static getFileName(toolCallId: string, toolName: string): string {
        return `${toolCallId}_${toolName}.json`;
    }
}
