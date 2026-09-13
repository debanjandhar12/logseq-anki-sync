import type {ExportedMessageRepository} from "@assistant-ui/react";

export function findToolPart(repository: ExportedMessageRepository, toolCallId: string) {
    for (const {message} of repository.messages) {
        for (const part of message.content) {
            if (part.type === "tool-call" && part.toolCallId === toolCallId) return part;
        }
    }
    throw new Error(`Tool call ${toolCallId} was not persisted`);
}
