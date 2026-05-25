/**
 * Implements ThreadHistoryAdapter so useAISDKRuntime can load persisted
 * messages when a thread is opened and persist new messages as they arrive.
 *
 * The storage format uses UIMessage (AI SDK v6 format) items, not ThreadMessage.
 * When useAISDKRuntime calls withFormat(aiSDKV6FormatAdapter), the returned
 * GenericThreadHistoryAdapter operates on UIMessage items directly, which are
 * stored as-is in ThreadStore.
 */
import type {
    ExportedMessageRepository,
    ExportedMessageRepositoryItem,
    GenericThreadHistoryAdapter,
    MessageFormatAdapter,
    MessageFormatItem,
    MessageFormatRepository,
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
                    createdByPluginVersion: "unknown"
                }
            };
        }

        if (!threadData.exportedMessageRepository) {
            threadData.exportedMessageRepository = {headId: null, messages: []};
        }

        threadData.exportedMessageRepository.messages.push(item);
        // headId must always point to the latest message in the chain
        threadData.exportedMessageRepository.headId = item.message.id;
        threadData.custom.updatedAt = new Date();

        await ThreadStore.saveThread(this.threadId, threadData);
    }

    withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
        formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>
    ): GenericThreadHistoryAdapter<TMessage> {
        const threadId = this.threadId;
        return {
            async load(): Promise<MessageFormatRepository<TMessage>> {
                const threadData = await ThreadStore.loadThread(threadId);
                if (!threadData?.exportedMessageRepository) {
                    return {headId: null, messages: []};
                }
                const repo = threadData.exportedMessageRepository;
                // Decode each stored message from storage format to TMessage format
                const messages: MessageFormatItem<TMessage>[] = repo.messages.map((item) => {
                    const storageEntry = {
                        id: item.message.id,
                        parent_id: item.parentId,
                        format: formatAdapter.format,
                        content: item.message as unknown as TStorageFormat
                    };
                    return formatAdapter.decode(storageEntry);
                });
                return {headId: repo.headId, messages};
            },

            async append(item: MessageFormatItem<TMessage>): Promise<void> {
                let threadData = await ThreadStore.loadThread(threadId);

                if (!threadData) {
                    threadData = {
                        remoteId: threadId,
                        status: "regular",
                        custom: {
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            createdByPluginVersion: "unknown"
                        }
                    };
                }

                if (!threadData.exportedMessageRepository) {
                    threadData.exportedMessageRepository = {headId: null, messages: []};
                }

                // Encode TMessage to storage format, then store as ExportedMessageRepositoryItem
                const encoded = formatAdapter.encode(item);
                const messageId = formatAdapter.getId(item.message);
                const storedItem: ExportedMessageRepositoryItem = {
                    parentId: item.parentId,
                    message: {id: messageId, ...encoded} as any
                };

                threadData.exportedMessageRepository.messages.push(storedItem);
                threadData.exportedMessageRepository.headId = messageId;
                threadData.custom.updatedAt = new Date();

                await ThreadStore.saveThread(threadId, threadData);
            }
        };
    }
}
