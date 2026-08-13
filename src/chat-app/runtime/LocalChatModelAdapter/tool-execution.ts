import type {ThreadMessage} from "@assistant-ui/react";
import {type Tool, ToolResponse} from "assistant-stream";
import {ChatToolResponse} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessage} from "./error-utils";
import type {ToolCallMessagePart, ToolCallResultPatch} from "./tool-call-message-part";
import {storeAndTruncateOversizedToolResult} from "./tool-result-limiter";

type AssistantStreamToolContext = Parameters<NonNullable<Tool["execute"]>>[1];
type ProjectToolContext = AssistantStreamToolContext & {messages: readonly ThreadMessage[]};

export class FrontendToolCancelledError extends Error {
    constructor() {
        super("The operation was aborted");
        this.name = "AbortError";
    }
}

export function isFrontendToolCancellation(error: unknown): boolean {
    return (
        error instanceof FrontendToolCancelledError ||
        (error instanceof Error && error.name === "AbortError")
    );
}

export async function invokeFrontendTool(
    tool: Tool,
    toolCall: ToolCallMessagePart,
    abortSignal: AbortSignal,
    messages: readonly ThreadMessage[]
): Promise<unknown> {
    if (!tool.execute) throw new Error(`Tool cannot be executed: ${toolCall.toolName}`);
    if (abortSignal.aborted) throw new FrontendToolCancelledError();

    const context: ProjectToolContext = {
        toolCallId: toolCall.toolCallId,
        abortSignal,
        messages,
        human: async () => {
            throw new Error("Human input is not supported by this chat adapter.");
        }
    };

    return raceWithAbort(tool.execute(toolCall.args, context), abortSignal);
}

export async function normalizeFrontendToolOutput(
    tool: Tool,
    toolCall: ToolCallMessagePart,
    output: unknown
): Promise<ToolCallResultPatch> {
    const response = ToolResponse.toResponse(output);
    const truncatedResult = await storeAndTruncateOversizedToolResult({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        result: response.result,
        isError: response.isError
    });
    if (truncatedResult !== undefined) {
        return {
            result: truncatedResult,
            artifact: response.artifact as ToolCallMessagePart["artifact"],
            isError: false
        };
    }

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
}

export function createFrontendToolErrorPatch(error: unknown): ToolCallResultPatch {
    const response = ChatToolResponse.error(getErrorMessage(error));
    return {result: response.result, isError: response.isError};
}

async function raceWithAbort<T>(
    operation: PromiseLike<T> | T,
    abortSignal: AbortSignal
): Promise<T> {
    if (abortSignal.aborted) throw new FrontendToolCancelledError();

    return new Promise<T>((resolve, reject) => {
        const handleAbort = () => reject(new FrontendToolCancelledError());
        abortSignal.addEventListener("abort", handleAbort, {once: true});
        Promise.resolve(operation)
            .then(resolve, reject)
            .finally(() => abortSignal.removeEventListener("abort", handleAbort));
    });
}
