import type {ExportedMessageRepository, ThreadAssistantMessage} from "@assistant-ui/react";

export function recoverInterruptedMessages(
    repository: ExportedMessageRepository,
    humanToolNames: readonly string[]
): ExportedMessageRepository {
    return {
        ...repository,
        messages: repository.messages.map((item) =>
            item.message.role === "assistant" && shouldRecoverMessage(item.message, humanToolNames)
                ? {
                      ...item,
                      message: {
                          ...item.message,
                          status: {type: "incomplete", reason: "cancelled"}
                      }
                  }
                : item
        )
    };
}

function shouldRecoverMessage(
    message: ThreadAssistantMessage,
    humanToolNames: readonly string[]
): boolean {
    if (message.status.type === "running") return true;
    if (message.status.type !== "requires-action" || message.status.reason === "interrupt") {
        return false;
    }

    return !message.content.some(
        (part) =>
            part.type === "tool-call" &&
            part.result === undefined &&
            ((part.approval !== undefined &&
                part.approval.approved === undefined &&
                part.approval.resolution === undefined) ||
                (part.approval === undefined && humanToolNames.includes(part.toolName)))
    );
}
