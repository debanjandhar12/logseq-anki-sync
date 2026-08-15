import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";

export const USER_TERMINATED_OPERATION = "User terminated the operation";
export const OPERATION_INTERRUPTED_DURING_THREAD_LOAD =
    "Operation was interrupted before completion because the chat was closed or reloaded";

export interface ToolTurnTarget {
    messageId: string;
}

export interface TerminateToolTurnResult {
    repository: ExportedMessageRepository;
    didChange: boolean;
}

/**
 * Makes one assistant turn terminal and gives every unresolved tool call an error result.
 * Target selection is the caller's responsibility so the same transformation can repair any branch.
 */
export function terminateToolTurn(
    repository: ExportedMessageRepository,
    options: {target: ToolTurnTarget; errorMessage: string}
): TerminateToolTurnResult {
    let didChange = false;
    const messages = repository.messages.map((item) => {
        if (item.message.id !== options.target.messageId || item.message.role !== "assistant") {
            return item;
        }
        if (!canTerminate(item.message.status)) return item;

        const content = item.message.content.map((part) => {
            if (part.type !== "tool-call" || part.result !== undefined) return part;
            didChange = true;
            return {
                ...part,
                result: {success: false, error: options.errorMessage},
                isError: true,
                ...(part.approval &&
                part.approval.approved === undefined &&
                part.approval.resolution === undefined
                    ? {
                          approval: {
                              ...part.approval,
                              resolution: "cancelled" as const,
                              reason: options.errorMessage
                          }
                      }
                    : {})
            };
        });
        if (
            item.message.status.type !== "incomplete" ||
            item.message.status.reason !== "cancelled"
        ) {
            didChange = true;
        }

        return {
            ...item,
            message: {
                ...item.message,
                content,
                status: {type: "incomplete", reason: "cancelled"}
            } as ThreadMessage
        };
    });

    return didChange
        ? {repository: {...repository, messages}, didChange: true}
        : {repository, didChange: false};
}

export function getActiveAssistantMessageTarget(
    repository: ExportedMessageRepository
): ToolTurnTarget | null {
    const activeMessageIds = getActiveBranchMessageIds(repository);
    const item = repository.messages.findLast(
        ({message}) => activeMessageIds.has(message.id) && message.role === "assistant"
    );
    return item ? {messageId: item.message.id} : null;
}

function canTerminate(status: ThreadMessage["status"]): boolean {
    return (
        status.type === "running" ||
        status.type === "requires-action" ||
        (status.type === "incomplete" && status.reason === "cancelled")
    );
}

function getActiveBranchMessageIds(repository: ExportedMessageRepository): Set<string> {
    const parentByMessageId = new Map(
        repository.messages.map((item) => [item.message.id, item.parentId] as const)
    );
    const activeMessageIds = new Set<string>();
    let messageId = repository.headId;
    while (messageId) {
        if (activeMessageIds.has(messageId)) break;
        activeMessageIds.add(messageId);
        messageId = parentByMessageId.get(messageId) ?? null;
    }
    return activeMessageIds;
}
