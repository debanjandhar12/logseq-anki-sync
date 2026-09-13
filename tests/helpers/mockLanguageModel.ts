import type {LanguageModelV4StreamPart} from "@ai-sdk/provider";
import {MockLanguageModelV4} from "ai/test";

const usage = {
    inputTokens: {total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0},
    outputTokens: {total: 0, text: 0, reasoning: 0}
};

export type MockLanguageModelTurn =
    | {type: "text"; text: string}
    | {type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown>};

export function createMultiTurnMockLanguageModel(
    turns: readonly MockLanguageModelTurn[]
): MockLanguageModelV4 {
    return new MockLanguageModelV4({
        doStream: turns.map((turn, index) => ({
            stream: streamForTurn(turn, index),
            response: {headers: {"x-mock-response": String(index + 1)}}
        }))
    });
}

function streamForTurn(
    turn: MockLanguageModelTurn,
    index: number
): ReadableStream<LanguageModelV4StreamPart> {
    const parts: LanguageModelV4StreamPart[] =
        turn.type === "text"
            ? [
                  {type: "text-start", id: `text-${index}`},
                  {type: "text-delta", id: `text-${index}`, delta: turn.text},
                  {type: "text-end", id: `text-${index}`},
                  {
                      type: "finish",
                      finishReason: {unified: "stop", raw: undefined},
                      usage
                  }
              ]
            : [
                  {
                      type: "tool-call",
                      toolCallId: turn.toolCallId,
                      toolName: turn.toolName,
                      input: JSON.stringify(turn.input)
                  },
                  {
                      type: "finish",
                      finishReason: {unified: "tool-calls", raw: undefined},
                      usage
                  }
              ];
    return new ReadableStream({
        start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
        }
    });
}
