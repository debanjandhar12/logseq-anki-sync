import {LogseqPluginStorageManager} from "../../../logseq/LogseqPluginStorageManager";
import type {ToolResultValue} from "./types";

export class ToolResultStore {
    static readonly groupName = "tool-results";

    static async storeToolResult(
        toolCallId: string,
        toolName: string,
        result: ToolResultValue
    ): Promise<void> {
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            ToolResultStore.getFileName(toolCallId, toolName),
            JSON.stringify(result)
        );
    }

    private static getFileName(toolCallId: string, toolName: string): string {
        return `${toolCallId}_${toolName}.json`;
    }
}
