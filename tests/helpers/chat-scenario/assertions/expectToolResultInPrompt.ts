import type {LanguageModelV4CallOptions} from "@ai-sdk/provider";
import {expect} from "vitest";

/** Provider results contain public JSON only; local rollback artifacts stay in the repository. */
export function expectToolResultInPrompt(
    prompt: LanguageModelV4CallOptions["prompt"],
    toolCallId: string,
    result: unknown,
    isError = false
): void {
    const parts = prompt.flatMap((message) => (message.role === "tool" ? message.content : []));
    const part = parts.find(
        (part) => part.type === "tool-result" && part.toolCallId === toolCallId
    );
    expect(part, `Missing provider tool result for ${toolCallId}`).toBeDefined();
    if (!part || part.type !== "tool-result") throw new Error(`Missing tool result ${toolCallId}`);
    expect(part.output).toEqual(
        isError
            ? {type: "error-text", value: JSON.stringify(result)}
            : {type: "json", value: result}
    );
    expect(part).not.toHaveProperty("artifact");
    const calls = prompt.flatMap((message) =>
        message.role === "assistant" ? message.content : []
    );
    for (const call of calls) {
        if (call.type === "tool-call" && call.toolCallId === toolCallId)
            expect(call).not.toHaveProperty("artifact");
    }
}
