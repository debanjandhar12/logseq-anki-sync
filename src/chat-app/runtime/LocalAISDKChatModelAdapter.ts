import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {convertToModelMessages, type LanguageModelUsage, streamText, type UIMessage} from "ai";
import {type Tool, ToolResponse} from "assistant-stream";
import {getLLMModel} from "../../core/ai-sdk/getLLMModel";

type TokenUsageMetadata = {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
};

/**
 * Bridges assistant-ui's LocalRuntime to the AI SDK calls. This was required as useAISDKRuntime
 * internally uses ExternalStoreRuntime and does not support branching.
 *
 * Reference implementation: @assistant-ui/react-ai-sdk/src/ui/use-chat/useAISDKRuntime.ts.
 */
export const LocalAISDKChatModelAdapter: ChatModelAdapter = {
    async *run({messages, abortSignal, context}) {
        let streamError: unknown;

        try {
            const model = await getLLMModel();
            const tools = context.tools ? frontendTools(context.tools as any) : undefined;
            const modelMessages = await convertToModelMessages(
                messages.map(threadMessageToUIMessage)
            );

            const result = streamText({
                model,
                system: context.system,
                messages: modelMessages,
                tools,
                abortSignal,
                ...context.callSettings,
                onError: ({error}) => {
                    streamError = error;
                }
            });

            let errorText = "";
            let content: NonNullable<ChatModelRunResult["content"]> = [];
            let usage: LanguageModelUsage | undefined;
            const toolExecutionPromises: Promise<void>[] = [];

            for await (const part of result.fullStream) {
                switch (part.type) {
                    case "text-delta":
                        errorText += part.text;
                        content = appendTextDelta(content, part.text);
                        yield {
                            content
                        };
                        break;
                    case "tool-call": {
                        const toolCall = createToolCallMessagePart(part);
                        content = [...content, toolCall];
                        yield {
                            content,
                            status: {type: "requires-action", reason: "tool-calls"}
                        };

                        const tool = context.tools?.[toolCall.toolName];
                        if (tool?.type !== "human" && tool?.execute) {
                            toolExecutionPromises.push(
                                executeFrontendTool(tool, toolCall, abortSignal).then(
                                    (toolResult) => {
                                        content = content.map((contentPart) =>
                                            contentPart.type === "tool-call" &&
                                            contentPart.toolCallId === toolCall.toolCallId
                                                ? {...contentPart, ...toolResult}
                                                : contentPart
                                        );
                                    }
                                )
                            );
                        }
                        break;
                    }
                    case "finish":
                        usage = part.totalUsage;
                        break;
                    case "error": {
                        const errorMessage = getErrorMessage(part.error);
                        yield createErrorMessageResult(errorText, errorMessage);
                        return;
                    }
                }
            }

            await Promise.all(toolExecutionPromises);

            const tokenUsage = usage ? normalizeTokenUsage(usage) : undefined;
            yield {
                content,
                status: content.some((part) => part.type === "tool-call")
                    ? {type: "requires-action", reason: "tool-calls"}
                    : {type: "complete", reason: "unknown"},
                metadata: tokenUsage ? {custom: {usage: tokenUsage}} : undefined
            };
        } catch (error) {
            yield createErrorMessageResult("", getErrorMessage(streamError ?? error));
        }
    }
};

type ToolCallStreamPart = {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    input: unknown;
};

type ToolCallMessagePart = Extract<
    NonNullable<ChatModelRunResult["content"]>[number],
    {type: "tool-call"}
>;

function appendTextDelta(
    content: NonNullable<ChatModelRunResult["content"]>,
    textDelta: string
): NonNullable<ChatModelRunResult["content"]> {
    const lastPart = content.at(-1);
    if (lastPart?.type !== "text") {
        return [...content, {type: "text", text: textDelta}];
    }

    return [...content.slice(0, -1), {...lastPart, text: `${lastPart.text}${textDelta}`}];
}

function createToolCallMessagePart(part: ToolCallStreamPart): ToolCallMessagePart {
    const args = isRecord(part.input) ? (part.input as ToolCallMessagePart["args"]) : {};
    return {
        type: "tool-call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args,
        argsText: JSON.stringify(args)
    };
}

async function executeFrontendTool(
    tool: Tool,
    toolCall: ToolCallMessagePart,
    abortSignal: AbortSignal
): Promise<Pick<ToolCallMessagePart, "result" | "isError">> {
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
            human: async () => {
                throw new Error("Human input is not supported by this chat adapter.");
            }
        });
        const response = ToolResponse.toResponse(output);
        return {result: response.result, isError: response.isError};
    } catch (error) {
        return {result: {error: getErrorMessage(error)}, isError: true};
    }
}

function createErrorMessageResult(existingText: string, errorMessage: string): ChatModelRunResult {
    const text = existingText ? `${existingText}\n\n${errorMessage}` : errorMessage;
    return {
        content: [{type: "text" as const, text}],
        status: {type: "incomplete", reason: "error", error: errorMessage}
    };
}

function getErrorMessage(error: unknown): string {
    if (isRecord(error)) {
        const cause = error.cause;
        const causeMessage =
            cause !== error && cause !== undefined ? getErrorMessage(cause) : undefined;
        const message = typeof error.message === "string" ? error.message : undefined;

        if (message === "No output generated. Check the stream for errors." && causeMessage) {
            return causeMessage;
        }
        if (message) return causeMessage ? `${message}: ${causeMessage}` : message;
    }
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "An unexpected error occurred.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeTokenUsage(usage: LanguageModelUsage): TokenUsageMetadata | undefined {
    const metadata: TokenUsageMetadata = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens,
        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens
    };
    const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
}

// Utility method
function threadMessageToUIMessage(message: ThreadMessage): UIMessage {
    const parts: UIMessage["parts"] = [];
    for (const part of getModelMessageParts(message)) {
        switch (part.type) {
            case "text":
                parts.push({type: "text", text: part.text});
                break;
            case "image":
                parts.push({
                    type: "file",
                    url: part.image,
                    mediaType: "image/png",
                    filename: part.filename
                });
                break;
            case "file":
                parts.push({
                    type: "file",
                    url: part.data,
                    mediaType: part.mimeType,
                    filename: part.filename
                });
                break;
            case "tool-call":
                parts.push(createToolUIMessagePart(part));
                break;
        }
    }

    return {
        id: message.id,
        role: message.role,
        parts,
        metadata: message.metadata
    } as UIMessage;
}

function createToolUIMessagePart(part: ToolCallMessagePart): UIMessage["parts"][number] {
    const input = part.args ?? {};
    if (part.result === undefined) {
        return {
            type: `tool-${part.toolName}`,
            toolCallId: part.toolCallId,
            state: "input-available",
            input
        } as UIMessage["parts"][number];
    }

    if (part.isError) {
        return {
            type: `tool-${part.toolName}`,
            toolCallId: part.toolCallId,
            state: "output-error",
            input,
            errorText: typeof part.result === "string" ? part.result : JSON.stringify(part.result)
        } as UIMessage["parts"][number];
    }

    return {
        type: `tool-${part.toolName}`,
        toolCallId: part.toolCallId,
        state: "output-available",
        input,
        output: part.result
    } as UIMessage["parts"][number];
}

type ModelMessagePart = ThreadMessage["content"][number];

function getModelMessageParts(message: ThreadMessage): ModelMessagePart[] {
    const parts: ModelMessagePart[] = [...message.content];

    for (const attachment of message.attachments ?? []) {
        parts.push(...attachment.content);
    }

    return parts.filter(isSupportedModelMessagePart);
}

function isSupportedModelMessagePart(part: ModelMessagePart): boolean {
    return (
        part.type === "text" ||
        part.type === "image" ||
        part.type === "file" ||
        part.type === "tool-call"
    );
}
