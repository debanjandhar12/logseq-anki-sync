import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {LocalThreadListAdapter} from "../../../../src/chat-app/runtime/LocalThreadListAdapter";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

describe("LocalThreadListAdapter", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("thread-list-adapter-test");
    });

    test("initializes a thread once under concurrent calls", async () => {
        const adapter = new LocalThreadListAdapter();
        const setItem = vi.spyOn(LogseqPluginStorageManager.store, "setItem");

        await Promise.all([adapter.initialize("thread-1"), adapter.initialize("thread-1")]);

        const files = await ThreadStore.listThreads();
        expect(files).toHaveLength(1);
        expect(files[0]).toMatchObject({remoteId: "thread-1", status: "regular"});
        expect(setItem).toHaveBeenCalledOnce();
    });

    test("metadata mutations preserve the latest message repository", async () => {
        const repository: ExportedMessageRepository = {
            headId: "assistant-message",
            messages: [
                {
                    parentId: null,
                    message: {
                        id: "assistant-message",
                        role: "assistant" as const,
                        createdAt: new Date(),
                        status: {type: "incomplete" as const, reason: "cancelled" as const},
                        metadata: {custom: {}},
                        content: [
                            {
                                type: "tool-call" as const,
                                toolCallId: "stopped-tool",
                                toolName: "test_tool",
                                args: {},
                                argsText: "{}",
                                result: {
                                    success: false,
                                    error: "User terminated the operation"
                                },
                                isError: true
                            }
                        ]
                    } as unknown as ThreadMessage
                }
            ]
        };
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: {
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: repository,
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            },
            result: undefined
        }));

        const adapter = new LocalThreadListAdapter();
        await adapter.rename("thread-1", "Renamed");
        await adapter.archive("thread-1");

        const threadData = await ThreadStore.loadThread("thread-1");
        expect(threadData).toMatchObject({title: "Renamed", status: "archived"});
        expect(threadData?.exportedMessageRepository?.headId).toBe(repository.headId);
        expect(
            threadData?.exportedMessageRepository?.messages[0]?.message.content[0]
        ).toMatchObject({
            toolCallId: "stopped-tool",
            result: {success: false, error: "User terminated the operation"}
        });
    });
});
