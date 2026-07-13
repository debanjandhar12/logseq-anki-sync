import type {ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {type Tool, ToolResponse} from "assistant-stream";
import {ChatToolResponse} from "src/chat-app/tools/base/ChatToolResponse";
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
): Promise<Pick<ToolCallMessagePart, "result" | "isError" | "artifact" | "modelContent">> {
    try {
        if (!tool.execute) {
            const errorResponse = ChatToolResponse.error(
                `Tool cannot be executed: ${toolCall.toolName}`
            );
            return {
                result: errorResponse.result,
                isError: errorResponse.isError
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
        const modelContent =
            response.modelContent ??
            (!response.isError && tool.toModelOutput
                ? await tool.toModelOutput({
                      toolCallId: toolCall.toolCallId,
                      input: toolCall.args,
                      output: response.result
                  })
                : undefined);
        return {
            result: response.result,
            artifact: response.artifact as ToolCallMessagePart["artifact"],
            isError: response.isError,
            modelContent
        };
    } catch (error) {
        const errorResponse = ChatToolResponse.error(getErrorMessage(error));
        return {
            result: errorResponse.result,
            isError: errorResponse.isError
        };
    }
}
