import type {ThreadMessage} from "@assistant-ui/react";
import type {UIMessage} from "ai";
import type {ToolCallMessagePart} from "./tool-execution";

export function threadMessageToUIMessage(message: ThreadMessage): UIMessage {
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
            case "tool-call":
                parts.push(createToolUIMessagePart(part));
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

export function createToolUIMessagePart(part: ToolCallMessagePart): UIMessage["parts"][number] {
    const input = part.args ?? {};
    if (part.result === undefined) {
        return {
            type: `tool-${part.toolName}`,
            toolCallId: part.toolCallId,
            state: "input-available",
            input
        } as UIMessage["parts"][number];
    }

    if (part.isError) {
        return {
            type: `tool-${part.toolName}`,
            toolCallId: part.toolCallId,
            state: "output-error",
            input,
            errorText: typeof part.result === "string" ? part.result : JSON.stringify(part.result)
        } as UIMessage["parts"][number];
    }

    return {
        type: `tool-${part.toolName}`,
        toolCallId: part.toolCallId,
        state: "output-available",
        input,
        output: part.result
    } as UIMessage["parts"][number];
}

type ModelMessagePart = ThreadMessage["content"][number];

export function getModelMessageParts(message: ThreadMessage): ModelMessagePart[] {
    const parts: ModelMessagePart[] = [...message.content];

    for (const attachment of message.attachments ?? []) {
        parts.push(...attachment.content);
    }

    return parts;
}
