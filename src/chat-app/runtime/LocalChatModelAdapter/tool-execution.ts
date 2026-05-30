import type {ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {type Tool, ToolResponse, toJSONSchema} from "assistant-stream";
import {getErrorMessage, isRecord} from "./error-utils";

type ToolCallStreamPart = {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    input: unknown;
};

export type ToolCallMessagePart = Extract<
    NonNullable<ChatModelRunResult["content"]>[number],
    {type: "tool-call"}
>;

export function createToolCallMessagePart(part: ToolCallStreamPart): ToolCallMessagePart {
    const args = isRecord(part.input) ? (part.input as ToolCallMessagePart["args"]) : {};
    return {
        type: "tool-call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args,
        argsText: JSON.stringify(args)
    };
}

export async function executeFrontendTool(
    tool: Tool,
    toolCall: ToolCallMessagePart,
    abortSignal: AbortSignal,
    messages: readonly ThreadMessage[]
): Promise<Pick<ToolCallMessagePart, "result" | "isError" | "artifact">> {
    try {
        if (!tool.execute) {
            return {
                result: {error: `Tool cannot be executed: ${toolCall.toolName}`},
                isError: true
            };
        }

        const output = await tool.execute(toolCall.args, {
            toolCallId: toolCall.toolCallId,
            abortSignal,
            messages,
            human: async () => {
                throw new Error("Human input is not supported by this chat adapter.");
            }
        } as any);
        const response = ToolResponse.toResponse(output);
        return {
            result: response.result,
            artifact: response.artifact as ToolCallMessagePart["artifact"],
            isError: response.isError
        };
    } catch (error) {
        return {result: {error: getErrorMessage(error)}, isError: true};
    }
}

export function toJSONSchemaToolSet(
    tools: Record<string, Tool>
): Record<string, {description?: string; parameters: any}> {
    return Object.fromEntries(
        Object.entries(tools).map(([toolName, tool]) => [
            toolName,
            {
                ...(tool.description ? {description: tool.description} : {}),
                parameters: tool.parameters ? toJSONSchema(tool.parameters) : {type: "object"}
            }
        ])
    );
}
