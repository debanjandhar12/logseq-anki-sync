
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
import type { ThreadHistoryAdapter } from '@assistant-ui/core';
import type { ExportedMessageRepository, ExportedMessageRepositoryItem } from '@assistant-ui/core';
import {ThreadStorage} from "../../core/storage/ThreadStorage";

export class LocalThreadHistoryAdapter implements ThreadHistoryAdapter {
    constructor(private readonly threadId: string) {}

    async load(): Promise<ExportedMessageRepository> {
        const thread = await ThreadStorage.loadThread(this.threadId);
        if (!thread || !thread.messages?.length) {
            return { headId: null, messages: [] };
        }

        const messages = thread.messages as ExportedMessageRepositoryItem[];
        const last = messages[messages.length - 1];
        const headId = last?.message?.id ?? null;
        return { headId, messages };
    }

    async append(item: ExportedMessageRepositoryItem): Promise<void> {
        await ThreadStorage.updateThread(this.threadId, (thread) => {
            if (!thread) return null;

            const existing = (thread.messages ?? []) as ExportedMessageRepositoryItem[];
            const idx = existing.findIndex((message) => message.message.id === item.message.id);
            if (idx >= 0) {
                existing[idx] = item;
            } else {
                existing.push(item);
            }

            return { ...thread, messages: existing };
        });
    }
}

