import type {ChatModelRunResult} from "@assistant-ui/react";
import {isRecord} from "./error-utils";

type ToolCallStreamPart = {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    input: unknown;
    providerExecuted?: boolean;
};

export type ToolCallMessagePart = Extract<
    NonNullable<ChatModelRunResult["content"]>[number],
    {type: "tool-call"}
> & {
    /** AI SDK provider-native calls must remain in assistant content. */
    providerExecuted?: boolean;
};

export type ToolCallResultPatch = Pick<
    ToolCallMessagePart,
    "result" | "isError" | "artifact" | "modelContent"
>;

export function createToolCallMessagePart(part: ToolCallStreamPart): ToolCallMessagePart {
    const args = isRecord(part.input) ? (part.input as ToolCallMessagePart["args"]) : {};
    return {
        type: "tool-call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args,
        argsText: JSON.stringify(args),
        ...(part.providerExecuted !== undefined ? {providerExecuted: part.providerExecuted} : {})
    };
}

export function updateToolCall(
    content: NonNullable<ChatModelRunResult["content"]>,
    toolCallId: string,
    update: Partial<ToolCallMessagePart>
): NonNullable<ChatModelRunResult["content"]> {
    return content.map((part) =>
        part.type === "tool-call" && part.toolCallId === toolCallId ? {...part, ...update} : part
    );
}

export function updateProviderToolCall(
    content: NonNullable<ChatModelRunResult["content"]>,
    toolCallId: string,
    update: Pick<ToolCallMessagePart, "result" | "isError">
): NonNullable<ChatModelRunResult["content"]> {
    return updateToolCall(content, toolCallId, {...update, providerExecuted: true});
}
