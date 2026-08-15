import type {
    RemoteThreadInitializeResponse,
    RemoteThreadListResponse,
    RemoteThreadMetadata
} from "@assistant-ui/core";
import type {RemoteThreadListAdapter, ThreadMessage} from "@assistant-ui/react";
import {createAssistantStream} from "assistant-stream";
import pkg from "../../../package.json";
import {ThreadStore} from "../../core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../core/stores/thread-store/types";
import {generateTitle} from "../../core/title-generator/generateTitle";

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
        await ThreadStore.updateThread(threadId, (existing) => {
            if (existing) return {type: "skip", result: undefined};

            const newThreadData: ThreadFileData = {
                remoteId: threadId,
                status: "regular",
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: pkg.version
                }
            };
            return {type: "save", threadData: newThreadData, result: undefined};
        });
        return {remoteId: threadId, externalId: threadId};
    }

    async fetch(threadId: string): Promise<RemoteThreadMetadata> {
        const threadData = await ThreadStore.loadThread(threadId);
        if (!threadData) throw new Error(`Thread data not found: ${threadId}`);
        return threadData;
    }

    async rename(remoteId: string, newTitle: string): Promise<void> {
        await ThreadStore.updateThread(remoteId, (threadData) => {
            if (!threadData) throw new Error(`Thread data not found: ${remoteId}`);
            threadData.title = newTitle;
            return {type: "save", threadData, result: undefined};
        });
    }

    async archive(remoteId: string): Promise<void> {
        await ThreadStore.updateThread(remoteId, (threadData) => {
            if (!threadData) throw new Error(`Thread data not found: ${remoteId}`);
            threadData.status = "archived";
            return {type: "save", threadData, result: undefined};
        });
    }

    async unarchive(remoteId: string): Promise<void> {
        await ThreadStore.updateThread(remoteId, (threadData) => {
            if (!threadData) throw new Error(`Thread data not found: ${remoteId}`);
            threadData.status = "regular";
            return {type: "save", threadData, result: undefined};
        });
    }

    async delete(remoteId: string): Promise<void> {
        await ThreadStore.deleteThread(remoteId);
    }

    async generateTitle(
        remoteId: string,
        messages: readonly ThreadMessage[]
    ): Promise<ReadableStream> {
        const chatTitle = await generateTitle(remoteId, messages);

        await ThreadStore.updateThread(remoteId, (threadData) => {
            if (!threadData) return {type: "skip", result: undefined};
            threadData.title = chatTitle;
            return {type: "save", threadData, result: undefined};
        });

        return createAssistantStream((controller) => {
            controller.appendText(chatTitle);
        });
    }
}
