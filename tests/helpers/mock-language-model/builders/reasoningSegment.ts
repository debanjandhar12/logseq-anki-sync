import type {ReasoningSegment, WaitSegment} from "../types";

export function reasoningSegment(
    text: string | readonly (string | WaitSegment)[]
): ReasoningSegment {
    return {type: "reasoning", chunks: typeof text === "string" ? [text] : text};
}
