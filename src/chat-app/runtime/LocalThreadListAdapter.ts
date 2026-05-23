import type {
    RemoteThreadInitializeResponse,
    RemoteThreadListResponse,
    RemoteThreadMetadata
} from "@assistant-ui/core";
import type {RemoteThreadListAdapter, ThreadMessage} from "@assistant-ui/react";
import pkg from "../../../package.json";
import {ThreadStore} from "../../core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../core/stores/thread-store/types";
import {generateTitle} from "../../core/title-generator/generateTitle";
import {createReadableStreamFromString} from "../utils/createReadableStreamFromString";

/**
 * Implement RemoteThreadListAdapter to provide thread list.
 * Actual messages are loaded via ThreadHistoryAdapter after thread is opened.
 */
export class LocalThreadListAdapter implements RemoteThreadListAdapter {
    async list(): Promise<RemoteThreadListResponse> {
        const threads = await ThreadStore.listThreads();
        return {threads: threads};
    }

    async initialize(threadId: string): Promise<RemoteThreadInitializeResponse> {
        const existing = await ThreadStore.loadThread(threadId);
        if (existing) {
            return {remoteId: threadId, externalId: threadId};
        }

        const newThreadData: ThreadFileData = {
            remoteId: threadId,
            status: "regular",
            custom: {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByPluginVersion: pkg.version
            }
        };
        await ThreadStore.saveThread(threadId, newThreadData);
        return {remoteId: threadId, externalId: threadId};
    }

    async fetch(threadId: string): Promise<RemoteThreadMetadata> {
        return await ThreadStore.loadThread(threadId);
    }

    async rename(remoteId: string, newTitle: string): Promise<void> {
        const threadData = await ThreadStore.loadThread(remoteId);
        threadData.title = newTitle;
        await ThreadStore.saveThread(remoteId, threadData);
    }

    async archive(remoteId: string): Promise<void> {
        const threadData = await ThreadStore.loadThread(remoteId);
        threadData.status = "archived";
        await ThreadStore.saveThread(remoteId, threadData);
    }

    async unarchive(remoteId: string): Promise<void> {
        const threadData = await ThreadStore.loadThread(remoteId);
        threadData.status = "regular";
        await ThreadStore.saveThread(remoteId, threadData);
    }

    async delete(remoteId: string): Promise<void> {
        await ThreadStore.deleteThread(remoteId);
    }

    async generateTitle(
        remoteId: string,
        messages: readonly ThreadMessage[]
    ): Promise<ReadableStream> {
        const chatTitle = generateTitle(remoteId, messages);
        return createReadableStreamFromString(chatTitle);
    }
}
