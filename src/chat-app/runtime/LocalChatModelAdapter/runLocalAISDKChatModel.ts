import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {
    convertToModelMessages,
    type FinishReason,
    type LanguageModelUsage,
    streamText,
    type ToolSet
} from "ai";
import {toToolsJSONSchema} from "assistant-stream";
import {createLLMModel} from "src/core/ai-sdk/getLLMModel";
import {getLLMProviderTools} from "src/core/ai-sdk/getLLMProviderTools";
import {readProviderConfigs} from "src/core/ai-sdk/provider-config/readProviderConfigs";
import {resolveLLMSelection} from "src/core/ai-sdk/provider-config/resolveLLMSelection";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import {getErrorMessage} from "./error-utils";
import {filterFrontendToolsForProvider} from "./filterFrontendToolsForProvider";
import {executeFrontendToolPlan} from "./frontend-tool-executor";
import {planFrontendToolCalls} from "./frontend-tool-planner";
import {threadMessageToUIMessage} from "./message-conversion";
import {
    appendReasoningDelta,
    appendTextDelta,
    createErrorMessageResult,
    normalizeTokenUsage
} from "./stream-helpers";
import {
    createToolCallMessagePart,
    type ToolCallMessagePart,
    updateProviderToolCall,
    updateToolCall
} from "./tool-call-message-part";

export async function* runLocalAISDKChatModel({
    messages,
    abortSignal,
    context,
    unstable_getMessage
}: Parameters<ChatModelAdapter["run"]>[0]): AsyncGenerator<ChatModelRunResult> {
    let streamError: unknown;
    let content: NonNullable<ChatModelRunResult["content"]> = [];

    try {
        const modelId = context.config?.modelName;
        if (!modelId) throw new Error("No model selected");
        const resolvedSelection = resolveLLMSelection(modelId, readProviderConfigs());
        const model = createLLMModel(resolvedSelection);
        const frontendToolDefinitions = filterFrontendToolsForProvider(
            context.tools,
            resolvedSelection.config.type,
            LogseqSettingAccessor.getPluginSettings().jinaApiKey
        );
        const tools = buildStreamTextTools(
            frontendToolDefinitions,
            getLLMProviderTools(resolvedSelection)
        );

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
        const clientToolCalls: ToolCallMessagePart[] = [];

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
                    content = [...content, toolCall];
                    if (part.providerExecuted) {
                        yield {content};
                    } else {
                        clientToolCalls.push(toolCall);
                        yield {content, status: {type: "running"}};
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
                    yield {content, status: {type: "incomplete", reason: "cancelled"}};
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
                case "error":
                    yield createErrorMessageResult(content, getErrorMessage(part.error));
                    return;
            }
        }

        const plan = planFrontendToolCalls(clientToolCalls, frontendToolDefinitions);
        for await (const event of executeFrontendToolPlan(plan, {
            abortSignal,
            getMessages: () => getCurrentBranchMessages(messages, unstable_getMessage())
        })) {
            if (event.type === "cancelled") {
                if (event.toolCallId && event.startedAt !== undefined) {
                    content = updateToolCall(content, event.toolCallId, {
                        timing: {startedAt: event.startedAt, completedAt: event.completedAt}
                    });
                }
                yield {content, status: {type: "incomplete", reason: "cancelled"}};
                return;
            }

            content = updateToolCall(
                content,
                event.toolCallId,
                event.type === "started"
                    ? {timing: {startedAt: event.startedAt}}
                    : {
                          ...event.patch,
                          ...(event.startedAt !== undefined && event.completedAt !== undefined
                              ? {
                                    timing: {
                                        startedAt: event.startedAt,
                                        completedAt: event.completedAt
                                    }
                                }
                              : {})
                      }
            );
            yield {content, status: {type: "running"}};
        }

        const tokenUsage = usage ? normalizeTokenUsage(usage) : undefined;
        yield {
            content,
            status:
                clientToolCalls.length > 0
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
        if (abortSignal.aborted || (error instanceof Error && error.name === "AbortError")) {
            yield {content, status: {type: "incomplete", reason: "cancelled"}};
            return;
        }
        yield createErrorMessageResult(content, getErrorMessage(streamError ?? error));
    }
}

function buildStreamTextTools(
    frontendToolDefinitions: Parameters<ChatModelAdapter["run"]>[0]["context"]["tools"],
    providerTools: ToolSet
): ToolSet {
    const convertedFrontendTools =
        frontendToolDefinitions && Object.keys(frontendToolDefinitions).length > 0
            ? frontendTools(toToolsJSONSchema(frontendToolDefinitions))
            : {};
    return {...convertedFrontendTools, ...providerTools};
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
