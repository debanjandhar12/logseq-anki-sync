import type {ExportedMessageRepository, ThreadAssistantMessage} from "@assistant-ui/react";
import {OPERATION_INTERRUPTED_DURING_THREAD_LOAD, terminateToolTurn} from "./terminateToolTurn";

/**
 * Repairs messages left in a transient state by a reload or crash. Real human actions remain
 * pending; runs that cannot resume become cancelled with terminal results for unresolved tools.
 */
export function recoverInterruptedMessagesDuringThreadLoad(
    repository: ExportedMessageRepository,
    humanToolNames: readonly string[]
): ExportedMessageRepository {
    return repository.messages.reduce(
        (recovered, item) =>
            item.message.role === "assistant" && shouldRecoverMessage(item.message, humanToolNames)
                ? terminateToolTurn(recovered, {
                      target: {messageId: item.message.id},
                      errorMessage: OPERATION_INTERRUPTED_DURING_THREAD_LOAD
                  }).repository
                : recovered,
        repository
    );
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
