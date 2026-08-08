import type {ReadonlyJSONValue} from "assistant-stream/utils";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR} from "src/constants";
import {JUST_BASH_USER_HOME} from "src/core/just-bash-wrapper/types";
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
    const filePath = `${JUST_BASH_USER_HOME}/${ToolResultStore.groupName}/${fileName}`;
    const removedCharacterCount = serializedResult.length - CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR;

    return `${serializedResult.slice(
        0,
        CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR
    )}\n...${removedCharacterCount} characters truncated...\n\nThe tool call succeeded but the output was truncated. Full output saved to: ${filePath}\nUse Bash tool to search and read with offset/limit to view specific sections.`;
}
