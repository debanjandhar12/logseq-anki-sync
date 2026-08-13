import type {Tool} from "assistant-stream";
import type {ToolCallMessagePart} from "./tool-call-message-part";

export type FrontendToolPlanItem =
    | {kind: "execute"; toolCall: ToolCallMessagePart; tool: Tool}
    | {kind: "await-human"; toolCall: ToolCallMessagePart}
    | {
          kind: "final-error";
          reason: "unknown-tool" | "missing-executor" | "blocked-by-human";
          toolCall: ToolCallMessagePart;
          message: string;
      };

export function planFrontendToolCalls(
    toolCalls: readonly ToolCallMessagePart[],
    tools: Readonly<Record<string, Tool>> | undefined
): readonly FrontendToolPlanItem[] {
    let hasHumanBoundary = false;

    return toolCalls.map((toolCall): FrontendToolPlanItem => {
        const tool = tools?.[toolCall.toolName];
        if (!tool) {
            return {
                kind: "final-error",
                reason: "unknown-tool",
                toolCall,
                message: `Unknown tool: ${toolCall.toolName}`
            };
        }

        if (tool.type === "human") {
            hasHumanBoundary = true;
            return {kind: "await-human", toolCall};
        }

        if (hasHumanBoundary) {
            return {
                kind: "final-error",
                reason: "blocked-by-human",
                toolCall,
                message: "Tool was not executed because an earlier tool requires user action."
            };
        }

        if (!tool.execute) {
            return {
                kind: "final-error",
                reason: "missing-executor",
                toolCall,
                message: `Tool cannot be executed: ${toolCall.toolName}`
            };
        }

        return {kind: "execute", toolCall, tool};
    });
}
