/**
 * Implements ThreadHistoryAdapter so useLocalRuntime can load persisted
 * messages when a thread is opened and persist new messages as they arrive.
 */
import type {
    ExportedMessageRepository,
    ExportedMessageRepositoryItem,
    GenericThreadHistoryAdapter,
    MessageFormatAdapter,
    ThreadHistoryAdapter
} from "@assistant-ui/react";
import {ThreadStore} from "../../core/stores/thread-store/ThreadStore";
import {recoverInterruptedMessages} from "./recoverInterruptedMessages";

export class LocalThreadHistoryAdapter implements ThreadHistoryAdapter {
    constructor(
        private readonly threadId: string,
        private readonly humanToolNames: readonly string[] = []
    ) {}

    async load(): Promise<ExportedMessageRepository> {
        const threadData = await ThreadStore.loadThread(this.threadId);
        if (threadData?.exportedMessageRepository) {
            return recoverInterruptedMessages(
                threadData.exportedMessageRepository,
                this.humanToolNames
            );
        }
        return {headId: null, messages: []};
    }

    async append(item: ExportedMessageRepositoryItem): Promise<void> {
        await ThreadStore.updateThread(this.threadId, (threadData) => {
            if (!threadData) throw new Error(`Thread data not found: ${this.threadId}`);

            const repository = threadData.exportedMessageRepository ?? {
                headId: null,
                messages: []
            };
            const existingMessageIndex = repository.messages.findIndex(
                ({message}) => message.id === item.message.id
            );
            if (existingMessageIndex >= 0) {
                repository.messages[existingMessageIndex] = item;
            } else {
                repository.messages.push(item);
            }

            repository.headId = item.message.id;
            threadData.exportedMessageRepository = repository;
            threadData.custom.updatedAt = new Date();
            return {type: "save", threadData, result: undefined};
        });
    }

    withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
        _formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>
    ): GenericThreadHistoryAdapter<TMessage> {
        // The base adapter already works with the external message format (UIMessage from AI SDK)
        // so we can simply cast and delegate to the base methods
        return this as unknown as GenericThreadHistoryAdapter<TMessage>;
    }
}
