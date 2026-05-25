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

export class LocalThreadHistoryAdapter implements ThreadHistoryAdapter {
    constructor(private readonly threadId: string) {}

    async load(): Promise<ExportedMessageRepository> {
        const threadData = await ThreadStore.loadThread(this.threadId);
        if (!threadData?.exportedMessageRepository) {
            return {headId: null, messages: []};
        }
        return threadData.exportedMessageRepository;
    }

    async append(item: ExportedMessageRepositoryItem): Promise<void> {
        let threadData = await ThreadStore.loadThread(this.threadId);
        if (!threadData) {
            threadData = {
                remoteId: this.threadId,
                status: "regular",
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "0.0.1"
                }
            };
        }

        if (!threadData.exportedMessageRepository) {
            threadData.exportedMessageRepository = {headId: item.message.id, messages: []};
        }

        threadData.exportedMessageRepository.messages.push(item);
        threadData.custom.updatedAt = new Date();

        await ThreadStore.saveThread(this.threadId, threadData);
    }

    withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
        _formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>
    ): GenericThreadHistoryAdapter<TMessage> {
        // The base adapter already works with the external message format (UIMessage from AI SDK)
        // so we can simply cast and delegate to the base methods
        return this as unknown as GenericThreadHistoryAdapter<TMessage>;
    }
}
