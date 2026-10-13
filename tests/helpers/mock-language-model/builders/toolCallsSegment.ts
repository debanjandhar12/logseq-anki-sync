import type {ToolCallSpec, ToolCallsSegment} from "../types";

export function toolCallsSegment(calls: readonly ToolCallSpec[]): ToolCallsSegment {
    return {type: "tool-calls", calls};
}
