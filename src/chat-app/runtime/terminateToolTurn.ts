import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";

export const USER_TERMINATED_OPERATION = "User terminated the operation";

export interface ToolTurnTarget {
    messageId: string;
    toolCallId?: string;
    toolName?: string;
}

export interface TerminateToolTurnResult {
    repository: ExportedMessageRepository;
    didChange: boolean;
}

export function terminateToolTurn(
    repository: ExportedMessageRepository,
    options: {target: ToolTurnTarget; errorMessage: string}
): TerminateToolTurnResult {
    if (!getActiveBranchMessageIds(repository).has(options.target.messageId)) {
        return {repository, didChange: false};
    }

    const targetItem = repository.messages.find(
        ({message}) => message.id === options.target.messageId
    );
    if (!targetItem || targetItem.message.role !== "assistant") {
        return {repository, didChange: false};
    }
    if (
        targetItem.message.status.type !== "running" &&
        targetItem.message.status.type !== "requires-action" &&
        !(
            targetItem.message.status.type === "incomplete" &&
            targetItem.message.status.reason === "cancelled"
        )
    ) {
        return {repository, didChange: false};
    }
    if (
        options.target.toolCallId &&
        !targetItem.message.content.some(
            (part) =>
                part.type === "tool-call" &&
                part.toolCallId === options.target.toolCallId &&
                (!options.target.toolName || part.toolName === options.target.toolName) &&
                part.result === undefined
        )
    ) {
        return {repository, didChange: false};
    }

    let didChange = false;
    const messages = repository.messages.map((item) => {
        if (item.message.id !== options.target.messageId || item.message.role !== "assistant") {
            return item;
        }

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
        if (!didChange) return item;

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
