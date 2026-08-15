import type {
    ExportedMessageRepository,
    ThreadAssistantMessage,
    ThreadMessage
} from "@assistant-ui/react";
import {OPERATION_INTERRUPTED_DURING_THREAD_LOAD, terminateToolTurn} from "./terminateToolTurn";

/**
 * Repairs messages left in a transient state by a reload or crash. Real human actions remain
 * pending; runs that cannot resume become cancelled with terminal results for unresolved tools.
 */
export function recoverInterruptedMessagesDuringThreadLoad(
    repository: ExportedMessageRepository,
    humanToolNames: readonly string[]
): ExportedMessageRepository {
    let didChange = false;
    const messages = repository.messages.map((item) => {
        if (item.message.role !== "assistant" || !isInterruptedMessage(item.message)) return item;

        const hasPendingHumanAction = item.message.content.some((part) =>
            isPendingHumanTool(part, humanToolNames)
        );
        if (!hasPendingHumanAction) {
            const terminated = terminateToolTurn(
                {...repository, messages: [item]},
                {
                    target: {messageId: item.message.id},
                    errorMessage: OPERATION_INTERRUPTED_DURING_THREAD_LOAD
                }
            );
            if (!terminated.didChange) return item;
            didChange = true;
            return terminated.repository.messages[0] ?? item;
        }

        let didRecoverAutomaticTool = false;
        const content = item.message.content.map((part) => {
            if (
                part.type !== "tool-call" ||
                part.result !== undefined ||
                isPendingHumanTool(part, humanToolNames)
            ) {
                return part;
            }
            didRecoverAutomaticTool = true;
            return {
                ...part,
                result: {
                    success: false,
                    error: OPERATION_INTERRUPTED_DURING_THREAD_LOAD
                },
                isError: true
            };
        });
        const mustRestoreHumanActionStatus = item.message.status.type === "running";
        if (!didRecoverAutomaticTool && !mustRestoreHumanActionStatus) return item;

        didChange = true;
        return {
            ...item,
            message: {
                ...item.message,
                content,
                status: {type: "requires-action", reason: "tool-calls"}
            } as ThreadMessage
        };
    });

    return didChange ? {...repository, messages} : repository;
}

function isInterruptedMessage(message: ThreadAssistantMessage): boolean {
    if (message.status.type === "running") return true;
    return message.status.type === "requires-action" && message.status.reason !== "interrupt";
}

function isPendingHumanTool(
    part: ThreadAssistantMessage["content"][number],
    humanToolNames: readonly string[]
): boolean {
    return (
        part.type === "tool-call" &&
        part.result === undefined &&
        ((part.approval !== undefined &&
            part.approval.approved === undefined &&
            part.approval.resolution === undefined) ||
            (part.approval === undefined && humanToolNames.includes(part.toolName)))
    );
}
