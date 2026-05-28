import type {ChatModelAdapter, ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import {frontendTools} from "@assistant-ui/react-ai-sdk";
import {convertToModelMessages, type LanguageModelUsage, streamText, type UIMessage} from "ai";
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
            const modelMessages = await convertToModelMessages(
                messages.map(threadMessageToUIMessage)
            );

            const result = streamText({
                model,
                system: context.system,
                messages: modelMessages,
                tools: context.tools ? frontendTools(context.tools as any) : undefined, // pass tools
                abortSignal,
                ...context.callSettings,
                onError: ({error}) => {
                    streamError = error;
                }
            });

            let text = "";
            let usage: LanguageModelUsage | undefined;

            for await (const part of result.fullStream) {
                switch (part.type) {
                    case "text-delta":
                        text += part.text;
                        yield {
                            content: [{type: "text", text}]
                        };
                        break;
                    case "finish":
                        usage = part.totalUsage;
                        break;
                    case "error": {
                        const errorMessage = getErrorMessage(part.error);
                        yield createErrorMessageResult(text, errorMessage);
                        return;
                    }
                }
            }

            const tokenUsage = usage ? normalizeTokenUsage(usage) : undefined;
            yield {
                status: {type: "complete", reason: "unknown"},
                metadata: tokenUsage ? {custom: {usage: tokenUsage}} : undefined
            };
        } catch (error) {
            yield createErrorMessageResult("", getErrorMessage(streamError ?? error));
        }
    }
};

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
        }
    }

    return {
        id: message.id,
        role: message.role,
        parts,
        metadata: message.metadata
    } as UIMessage;
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
    return part.type === "text" || part.type === "image" || part.type === "file";
}
