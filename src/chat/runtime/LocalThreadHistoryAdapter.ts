// ---------------------------------------------------------------------------
// LocalThreadHistoryAdapter
//
// Implements ThreadHistoryAdapter so useLocalRuntime can load persisted
// messages when a thread is opened, and persist new messages as they arrive.
//
// Key design decisions:
//  - Uses ThreadStorage.loadThread(id) — reads exactly one file, not the
//    entire directory.
//  - append() updates a single thread atomically through ThreadStorage.
// ---------------------------------------------------------------------------
import type {
    ExportedMessageRepository,
    ExportedMessageRepositoryItem,
    ThreadHistoryAdapter
} from "@assistant-ui/react";
import {ThreadStore} from "../../logseq/stores/thread-store/ThreadStore";

export class LocalThreadHistoryAdapter implements ThreadHistoryAdapter {
    constructor(private readonly threadId: string) {}

    async load(): Promise<ExportedMessageRepository> {
        const threadData = await ThreadStore.loadThread(this.threadId);
        if (!threadData || !threadData.exportedMessageRepository) {
            return {headId: null, messages: []};
        }
        return threadData.exportedMessageRepository;
    }

    async append(item: ExportedMessageRepositoryItem): Promise<void> {
        const threadData = await ThreadStore.loadThread(this.threadId);
        
        if (!threadData.exportedMessageRepository) {
            threadData.exportedMessageRepository = {headId: item.message.id, messages: []};
        }
        
        threadData.exportedMessageRepository.messages.push(item);
        threadData.custom.updatedAt = new Date();
        
        await ThreadStore.saveThread(this.threadId, threadData);
    }
}
