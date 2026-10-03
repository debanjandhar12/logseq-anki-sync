import type {ReadonlyJSONValue} from "assistant-stream/utils";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR, VIR_ENV_USER_PATH} from "src/constants";
import {ToolResultStore} from "src/core/stores/tool-results/ToolResultStore";

type ToolResultLimitInput = {
    toolCallId: string;
    toolName: string;
    result: ReadonlyJSONValue;
    isError: boolean;
};

export async function storeAndTruncateOversizedToolResult({
    toolCallId,
    toolName,
    result,
    isError
}: ToolResultLimitInput): Promise<string | undefined> {
    if (isError) return undefined;

    const serializedResult = JSON.stringify(result, null, 2);
    if (serializedResult.length <= CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR) return undefined;

    const fileName = await ToolResultStore.storeToolResult(toolCallId, toolName, result);
    const filePath = `${VIR_ENV_USER_PATH}/${ToolResultStore.groupName}/${fileName}`;
    const removedCharacterCount = serializedResult.length - CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR;

    return `${serializedResult.slice(
        0,
        CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR
    )}\n...${removedCharacterCount} characters truncated...\n\nThe tool call succeeded but the output was truncated. Full output saved to: ${filePath}\nUse Bash tool to search and read with offset/limit to view specific sections.`;
}
