import type {ChatModelRunResult} from "@assistant-ui/react";
import type {LanguageModelUsage} from "ai";

export type TokenUsageMetadata = {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
};

export function appendTextDelta(
    content: NonNullable<ChatModelRunResult["content"]>,
    textDelta: string
): NonNullable<ChatModelRunResult["content"]> {
    const lastPart = content.at(-1);
    if (lastPart?.type !== "text") {
        return [...content, {type: "text", text: textDelta}];
    }

    return [...content.slice(0, -1), {...lastPart, text: `${lastPart.text}${textDelta}`}];
}

export function appendReasoningDelta(
    content: NonNullable<ChatModelRunResult["content"]>,
    textDelta: string
): NonNullable<ChatModelRunResult["content"]> {
    const lastPart = content.at(-1);
    if (lastPart?.type !== "reasoning") {
        return [...content, {type: "reasoning", text: textDelta}];
    }

    return [...content.slice(0, -1), {...lastPart, text: `${lastPart.text}${textDelta}`}];
}

export function createErrorMessageResult(
    content: NonNullable<ChatModelRunResult["content"]>,
    errorMessage: string
): ChatModelRunResult {
    const text = content.at(-1)?.type === "text" ? `\n\n${errorMessage}` : errorMessage;
    return {
        content: appendTextDelta(content, text),
        status: {type: "incomplete", reason: "error", error: errorMessage}
    };
}

export function normalizeTokenUsage(usage: LanguageModelUsage): TokenUsageMetadata | undefined {
    const metadata: TokenUsageMetadata = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens
    };
    const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
}
