import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {
    convertToModelMessages,
    type FinishReason,
    type LanguageModelUsage,
    streamText,
    type ToolSet
} from "ai";
import {type Tool, toToolsJSONSchema} from "assistant-stream";
import {getLLMModel} from "../../../core/ai-sdk/getLLMModel";
import {getLLMProviderTools} from "../../../core/ai-sdk/getLLMProviderTools";
import {getErrorMessage} from "./error-utils";
import {threadMessageToUIMessage} from "./message-conversion";
import {
    appendReasoningDelta,
    appendTextDelta,
    createErrorMessageResult,
    normalizeTokenUsage
} from "./stream-helpers";
import {
    createToolCallMessagePart,
    executeFrontendTool,
    type ToolCallMessagePart
} from "./tool-execution";

/**
 * Bridges assistant-ui's LocalRuntime to the AI SDK.
 *
 * LocalRuntime is intentional here. assistant-ui's useAISDKRuntime is backed by
 * ExternalStoreRuntime, which currently does not support message branching; this chat app needs
 * branch-aware local thread state while still using AI SDK models and tool schemas.
 *
 * LocalRuntime calls run() with context messages up to the parent user message. During tool
 * roundtrips, the in-progress assistant message is a child of that user message, so
 * performRoundtrip's getMessages(parentId) traversal does not include it. unstable_getMessage()
 * is the only runtime-provided way to read that current assistant message, including tool calls
 * and tool results from previous roundtrips.
 *
 * Each yield must contain content for the current LLM step only. LocalRuntime keeps the assistant
 * message's previous roundtrip content as initialContent and appends the yielded content via
 * updateMessage. Yielding the full assistant message here would duplicate prior tool calls/results.
 *
 * Automatic tool calls remain running while their inline executors are active. The final yield
 * uses {type: "requires-action", reason: "tool-calls"} so LocalRuntime's shouldContinue loop can
 * start the next LLM roundtrip after every non-human tool call has a result.
 */
export const LocalAISDKChatModelAdapter: ChatModelAdapter = {
    async *run({messages, abortSignal, context, unstable_getMessage}) {
        let streamError: unknown;
        let content: NonNullable<ChatModelRunResult["content"]> = [];

        try {
            const modelId = context.config?.modelName;
            if (!modelId) throw new Error("No model selected");
            const model = await getLLMModel(modelId);
            const tools = buildStreamTextTools(context.tools, getLLMProviderTools());

            const currentAssistantMessage = unstable_getMessage();
            const conversationMessages = hasToolResults(currentAssistantMessage)
                ? [...messages, currentAssistantMessage]
                : messages;
            const modelMessages = await convertToModelMessages(
                conversationMessages.map(threadMessageToUIMessage),
                {tools}
            );

            const reasoningEffort = context.config?.reasoningEffort as
                | "low"
                | "medium"
                | "high"
                | undefined;

            const result = streamText({
                model,
                instructions: context.system,
                messages: modelMessages,
                tools,
                abortSignal,
                ...context.callSettings,
                ...(reasoningEffort ? {reasoning: reasoningEffort} : {}),
                onError: ({error}) => {
                    streamError = error;
                }
            });

            let usage: LanguageModelUsage | undefined;
            let finishReason: FinishReason | undefined;
            let hasClientToolCalls = false;
            const toolCallsToExecute: Array<{tool: Tool; toolCall: ToolCallMessagePart}> = [];

            for await (const part of result.stream) {
                switch (part.type) {
                    case "text-delta":
                        content = appendTextDelta(content, part.text);
                        yield {content};
                        break;
                    case "reasoning-delta":
                        content = appendReasoningDelta(content, part.text);
                        yield {content};
                        break;
                    case "tool-call": {
                        const toolCall = createToolCallMessagePart(part);

                        if (part.providerExecuted) {
                            content = [...content, toolCall];
                            yield {content};
                            break;
                        }

                        hasClientToolCalls = true;
                        content = [...content, toolCall];
                        yield {content, status: {type: "running"}};

                        const tool = context.tools?.[toolCall.toolName];
                        if (tool && tool.type !== "human") {
                            toolCallsToExecute.push({tool, toolCall});
                        }
                        break;
                    }
                    case "source":
                        content = [...content, part];
                        yield {content};
                        break;
                    case "file":
                        content = [
                            ...content,
                            {
                                type: "file",
                                data: `data:${part.file.mediaType};base64,${part.file.base64}`,
                                mimeType: part.file.mediaType
                            }
                        ];
                        yield {content};
                        break;
                    case "finish":
                        usage = part.totalUsage;
                        finishReason = part.finishReason;
                        break;
                    case "abort":
                        yield {
                            content,
                            status: {type: "incomplete", reason: "cancelled"}
                        };
                        return;
                    case "tool-result":
                        if (part.providerExecuted) {
                            content = updateProviderToolCall(content, part.toolCallId, {
                                result: part.output === undefined ? null : part.output,
                                isError: false
                            });
                            yield {content};
                        }
                        break;
                    case "tool-error":
                        if (part.providerExecuted) {
                            content = updateProviderToolCall(content, part.toolCallId, {
                                result: getErrorMessage(part.error),
                                isError: true
                            });
                            yield {content};
                        }
                        break;
                    case "error": {
                        const errorMessage = getErrorMessage(part.error);
                        yield createErrorMessageResult(content, errorMessage);
                        return;
                    }
                }
            }

            for (const {tool, toolCall} of toolCallsToExecute) {
                const startedAt = Date.now();
                content = updateToolCall(content, toolCall.toolCallId, {
                    timing: {startedAt}
                });
                yield {content, status: {type: "running"}};

                const toolResult = await executeFrontendTool(
                    tool,
                    toolCall,
                    abortSignal,
                    getCurrentBranchMessages(messages, unstable_getMessage())
                );

                content = updateToolCall(content, toolCall.toolCallId, {
                    ...toolResult,
                    timing: {startedAt, completedAt: Date.now()}
                });

                yield {content, status: {type: "running"}};
            }

            const tokenUsage = usage ? normalizeTokenUsage(usage) : undefined;
            yield {
                content,
                status: hasClientToolCalls
                    ? {type: "requires-action", reason: "tool-calls"}
                    : toMessageStatus(finishReason),
                metadata: {
                    steps: [
                        {
                            usage:
                                usage?.inputTokens !== undefined && usage.outputTokens !== undefined
                                    ? {
                                          inputTokens: usage.inputTokens,
                                          outputTokens: usage.outputTokens
                                      }
                                    : undefined
                        }
                    ],
                    ...(tokenUsage ? {custom: {usage: tokenUsage}} : {})
                }
            };
        } catch (error) {
            yield createErrorMessageResult(content, getErrorMessage(streamError ?? error));
        }
    }
};

function buildStreamTextTools(
    frontendToolDefinitions: Parameters<ChatModelAdapter["run"]>[0]["context"]["tools"],
    providerTools: ToolSet
): ToolSet {
    const convertedFrontendTools =
        frontendToolDefinitions && Object.keys(frontendToolDefinitions).length > 0
            ? frontendTools(toToolsJSONSchema(frontendToolDefinitions))
            : {};

    return {
        ...convertedFrontendTools,
        ...providerTools
    };
}

function toMessageStatus(finishReason: FinishReason | undefined): ChatModelRunResult["status"] {
    switch (finishReason) {
        case "stop":
            return {type: "complete", reason: "stop"};
        case "length":
            return {type: "incomplete", reason: "length"};
        case "content-filter":
            return {type: "incomplete", reason: "content-filter"};
        case "tool-calls":
            return {type: "incomplete", reason: "tool-calls"};
        case "error":
            return {type: "incomplete", reason: "error"};
        case "other":
            return {type: "incomplete", reason: "other"};
        default:
            return {type: "complete", reason: "unknown"};
    }
}

function hasToolResults(message: ThreadMessage): boolean {
    return (
        message.role === "assistant" &&
        message.content.some((part) => part.type === "tool-call" && part.result !== undefined)
    );
}

function getCurrentBranchMessages(
    messages: readonly ThreadMessage[],
    assistantMessage: ThreadMessage
): readonly ThreadMessage[] {
    return assistantMessage.content.length ? [...messages, assistantMessage] : messages;
}

function updateProviderToolCall(
    content: NonNullable<ChatModelRunResult["content"]>,
    toolCallId: string,
    update: Pick<ToolCallMessagePart, "result" | "isError">
): NonNullable<ChatModelRunResult["content"]> {
    return content.map((part) =>
        part.type === "tool-call" && part.toolCallId === toolCallId
            ? {...part, ...update, providerExecuted: true}
            : part
    );
}

function updateToolCall(
    content: NonNullable<ChatModelRunResult["content"]>,
    toolCallId: string,
    update: Partial<ToolCallMessagePart>
): NonNullable<ChatModelRunResult["content"]> {
    return content.map((part) =>
        part.type === "tool-call" && part.toolCallId === toolCallId ? {...part, ...update} : part
    );
}
