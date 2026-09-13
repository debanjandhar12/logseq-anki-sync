import type {LanguageModelV4FinishReason} from "@ai-sdk/provider";
import type {MockLanguageModelV4} from "ai/test";

export type ToolCallSpec = {
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
};

export type WaitSegment = {type: "wait"; until: Promise<void>; onReached?: () => void};
export type TextSegment = {type: "text"; chunks: readonly (string | WaitSegment)[]};
export type ReasoningSegment = {type: "reasoning"; chunks: readonly (string | WaitSegment)[]};
export type ToolCallsSegment = {type: "tool-calls"; calls: readonly ToolCallSpec[]};
export type Segment = TextSegment | ReasoningSegment | ToolCallsSegment | WaitSegment;

/** One step represents one provider request, including automatic tool follow-ups. */
export type ModelStep = {
    segments: readonly Segment[];
    finishReason?: LanguageModelV4FinishReason["unified"];
};

export type ControlledMockLanguageModel = MockLanguageModelV4 & {
    assertHealthy(): void;
    dispose(): Promise<void>;
};
