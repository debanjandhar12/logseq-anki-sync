import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {convertToModelMessages, type LanguageModelUsage, streamText} from "ai";
import {getLLMModel} from "../../../core/ai-sdk/getLLMModel";
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
    toJSONSchemaToolSet
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
 * Tool calls must yield status {type: "requires-action", reason: "tool-calls"}, including after
 * inline tool execution has produced results. LocalRuntime's shouldContinue loop only starts the
 * next LLM roundtrip from that status, and it waits until every non-human tool call has a result.
 */
export const LocalAISDKChatModelAdapter: ChatModelAdapter = {
    async *run({messages, abortSignal, context, unstable_getMessage}) {
        let streamError: unknown;

        try {
            const model = await getLLMModel();
            const tools = context.tools
                ? frontendTools(toJSONSchemaToolSet(context.tools))
                : undefined;

            const currentAssistantMessage = unstable_getMessage();
            const conversationMessages = hasToolResults(currentAssistantMessage)
                ? [...messages, currentAssistantMessage]
                : messages;
            const modelMessages = await convertToModelMessages(
                conversationMessages.map(threadMessageToUIMessage)
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

            // Preserved so stream errors can keep already-rendered text before appending the error.
            let partialText = "";
            let content: NonNullable<ChatModelRunResult["content"]> = [];
            let usage: LanguageModelUsage | undefined;
            let toolExecutionQueue = Promise.resolve();

            for await (const part of result.fullStream) {
                switch (part.type) {
                    case "text-delta":
                        partialText += part.text;
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
                        yield {
                            content,
                            status: {type: "requires-action", reason: "tool-calls"}
                        };

                        const tool = context.tools?.[toolCall.toolName];
                        if (tool?.type !== "human" && tool?.execute) {
                            toolExecutionQueue = toolExecutionQueue.then(async () => {
                                const toolResult = await executeFrontendTool(
                                    tool,
                                    toolCall,
                                    abortSignal,
                                    getCurrentBranchMessages(messages, unstable_getMessage())
                                );
                                content = content.map((contentPart) =>
                                    contentPart.type === "tool-call" &&
                                    contentPart.toolCallId === toolCall.toolCallId
                                        ? {...contentPart, ...toolResult}
                                        : contentPart
                                );
                            });
                        }
                        break;
                    }
                    case "finish":
                        usage = part.totalUsage;
                        break;
                    case "error": {
                        const errorMessage = getErrorMessage(part.error);
                        yield createErrorMessageResult(partialText, errorMessage);
                        return;
                    }
                }
            }

            await toolExecutionQueue;

            const tokenUsage = usage ? normalizeTokenUsage(usage) : undefined;
            const hasToolCalls = content.some((part) => part.type === "tool-call");
            yield {
                content,
                status: hasToolCalls
                    ? {type: "requires-action", reason: "tool-calls"}
                    : {type: "complete", reason: "unknown"},
                metadata: tokenUsage ? {custom: {usage: tokenUsage}} : undefined
            };
        } catch (error) {
            yield createErrorMessageResult("", getErrorMessage(streamError ?? error));
        }
    }
};

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
