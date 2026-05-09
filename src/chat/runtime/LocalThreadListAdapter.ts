import type {
    RemoteThreadListAdapter,
    RemoteThreadListResponse,
    RemoteThreadInitializeResponse,
    RemoteThreadMetadata,
} from '@assistant-ui/core';
import { ThreadStorage, type ThreadFileData } from '../../core/storage/ThreadStorage';

// ---------------------------------------------------------------------------
// LocalThreadListAdapter
//
// Fully implements RemoteThreadListAdapter backed by the filesystem.
//
// Single-thread operations (rename, archive, unarchive, fetch) read only one
// file instead of scanning the entire directory.
//
// The runtime owns thread-list state. This adapter is only responsible for
// reading and persisting thread metadata/history on disk.
// ---------------------------------------------------------------------------
export class LocalThreadListAdapter implements RemoteThreadListAdapter {
    async list(): Promise<RemoteThreadListResponse> {
        const threads = await ThreadStorage.listThreads();
        return { threads: threads.map(t => this._toMetadata(t)) };
    }

    async initialize(threadId: string): Promise<RemoteThreadInitializeResponse> {
        const existing = await ThreadStorage.loadThread(threadId);
        if (existing) {
            return { remoteId: threadId, externalId: threadId };
        }

        const newThread: ThreadFileData = {
            id: threadId,
            metadata: {},
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await ThreadStorage.saveThread(newThread);
        return { remoteId: threadId, externalId: threadId };
    }

    async fetch(threadId: string): Promise<RemoteThreadMetadata> {
        const thread = await ThreadStorage.loadThread(threadId);
        if (!thread) throw new Error(`[LocalThreadListAdapter] Thread "${threadId}" not found`);
        return this._toMetadata(thread);
    }

    async rename(remoteId: string, newTitle: string): Promise<void> {
        await updateThreadMetadata(remoteId, (metadata) => ({ ...metadata, title: newTitle }));
    }

    async archive(remoteId: string): Promise<void> {
        await updateThreadMetadata(remoteId, (metadata) => ({ ...metadata, status: 'archived' }));
    }

    async unarchive(remoteId: string): Promise<void> {
        await updateThreadMetadata(remoteId, (metadata) => ({ ...metadata, status: 'regular' }));
    }

    async delete(remoteId: string): Promise<void> {
        await ThreadStorage.deleteThread(remoteId);
    }

    async generateTitle(): Promise<any> {
        // TODO: Implement title generation
        return new ReadableStream();
    }

    private _toMetadata(thread: ThreadFileData): RemoteThreadMetadata {
        return {
            remoteId: thread.id,
            externalId: thread.id,
            title: (thread.metadata?.title ?? thread.metadata?.mode ?? undefined) as string | undefined,
            status: thread.metadata?.status === 'archived' ? 'archived' : 'regular',
            updatedAt: thread.updatedAt,
            messageCount: thread.messages.length,
        } as RemoteThreadMetadata & { updatedAt: Date; messageCount: number };
    }
}

// Utility methods
async function updateThreadMetadata(
    threadId: string,
    updater: (metadata: ThreadFileData['metadata']) => ThreadFileData['metadata'],
): Promise<void> {
    await ThreadStorage.updateThread(threadId, (thread) => {
        if (!thread) return null;
        return { ...thread, metadata: updater(thread.metadata) };
    });
}