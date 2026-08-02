import type {ExportedMessageRepository, ThreadMessage, ThreadRuntime} from "@assistant-ui/react";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";

const USER_CANCELED_OPERATION = "User canceled operation";

export function cancelPendingToolCallsInRepository(
    repository: ExportedMessageRepository
): ExportedMessageRepository {
    const activeBranchMessageIds = getActiveBranchMessageIds(repository);
    const pendingMessageId = repository.messages.findLast(
        (item) =>
            activeBranchMessageIds.has(item.message.id) &&
            item.message.role === "assistant" &&
            item.message.status.type === "requires-action"
    )?.message.id;
    if (!pendingMessageId) return repository;

    const messages = repository.messages.map((item) => {
        const message = item.message;
        if (message.id !== pendingMessageId) return item;

        let changed = false;
        const content = message.content.map((part) => {
            if (part.type !== "tool-call" || part.result !== undefined) return part;
            changed = true;
            return {
                ...part,
                result: {success: false, error: USER_CANCELED_OPERATION},
                isError: true,
                ...(part.approval && part.approval.resolution === undefined
                    ? {
                          approval: {
                              ...part.approval,
                              resolution: "cancelled" as const,
                              reason: USER_CANCELED_OPERATION
                          }
                      }
                    : {})
            };
        });
        if (!changed) return item;

        return {
            ...item,
            message: {
                ...message,
                content,
                status: {type: "incomplete", reason: "cancelled"}
            } as ThreadMessage
        };
    });
    return {...repository, messages};
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

export async function cancelPendingToolCallsInThread(options: {
    threadId: string;
    runtime: ThreadRuntime;
}): Promise<void> {
    const patchedRepository = cancelPendingToolCallsInRepository(options.runtime.export());
    options.runtime.import(patchedRepository);

    const threadData = await ThreadStore.loadThread(options.threadId);
    if (!threadData?.exportedMessageRepository) return;
    threadData.exportedMessageRepository = cancelPendingToolCallsInRepository(
        threadData.exportedMessageRepository
    );
    threadData.custom.updatedAt = new Date();
    await ThreadStore.saveThread(options.threadId, threadData);
}
