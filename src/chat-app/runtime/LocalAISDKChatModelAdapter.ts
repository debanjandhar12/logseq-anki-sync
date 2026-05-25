import type {ChatModelAdapter, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {convertToModelMessages, streamText, type UIMessage} from "ai";
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
        try {
            const model = await getLLMModel();
            const modelMessages = await convertToModelMessages(
                messages.map(threadMessageToUIMessage)
            );

            const result = streamText({
                model,
                system: context.system,
                messages: modelMessages,
                tools: context.tools ? frontendTools(context.tools as any) : undefined, // pass tools
                abortSignal,
                ...context.callSettings
            });

            let text = "";
            for await (const delta of result.textStream) {
                text += delta;
                yield {
                    content: [{type: "text", text}]
                };
            }

            const usage = normalizeTokenUsage(await result.totalUsage);
            yield {
                status: {type: "complete", reason: "unknown"},
                metadata: usage ? {custom: {usage}} : undefined
            };
        } catch (error) {
            yield {
                content: [{type: "text", text: getErrorMessage(error)}],
                status: {type: "incomplete", reason: "error", error: getErrorMessage(error)}
            };
        }
    }
};

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "An unexpected error occurred.";
}

function normalizeTokenUsage(usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    outputTokenDetails?: {reasoningTokens?: number};
    inputTokenDetails?: {cacheReadTokens?: number};
    reasoningTokens?: number;
    cachedInputTokens?: number;
}): TokenUsageMetadata | undefined {
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
    for (const part of message.content) {
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
        }
    }

    return {
        id: message.id,
        role: message.role,
        parts,
        metadata: message.metadata
    } as UIMessage;
}
