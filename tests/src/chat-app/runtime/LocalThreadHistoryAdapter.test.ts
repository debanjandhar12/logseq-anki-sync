import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {beforeEach, describe, expect, test} from "vitest";
import {LocalThreadHistoryAdapter} from "../../../../src/chat-app/runtime/LocalThreadHistoryAdapter";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import type {ThreadFileData} from "../../../../src/core/stores/thread-store/types";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

function createThread(repository?: ExportedMessageRepository): ThreadFileData {
    return {
        remoteId: "thread-1",
        status: "regular",
        exportedMessageRepository: repository,
        custom: {
            createdAt: new Date(),
            updatedAt: new Date(),
            createdByPluginVersion: "test"
        }
    };
}

function terminatedAssistantMessage(): ThreadMessage {
    return {
        id: "terminated-assistant",
        role: "assistant",
        createdAt: new Date(),
        status: {type: "incomplete", reason: "cancelled"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId: "terminated-tool",
                toolName: "test_tool",
                args: {},
                argsText: "{}",
                result: {success: false, error: "User terminated the operation"},
                isError: true
            }
        ]
    } as unknown as ThreadMessage;
}

function continuationMessage(): ThreadMessage {
    return {
        id: "continuation",
        role: "user",
        createdAt: new Date(),
        content: [{type: "text", text: "Continue"}],
        attachments: [],
        metadata: {custom: {}}
    } as unknown as ThreadMessage;
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
    let resolve: (() => void) | undefined;
    const promise = new Promise<void>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return {promise, resolve: () => resolve?.()};
}

describe("LocalThreadHistoryAdapter", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("history-adapter-test");
    });

    test("appends a continuation without removing a prior terminated tool result", async () => {
        const terminatedMessage = terminatedAssistantMessage();
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: createThread({
                headId: terminatedMessage.id,
                messages: [{message: terminatedMessage, parentId: null}]
            }),
            result: undefined
        }));

        const continuation = continuationMessage();
        await new LocalThreadHistoryAdapter("thread-1").append({
            message: continuation,
            parentId: terminatedMessage.id
        });

        const threadData = await ThreadStore.loadThread("thread-1");
        expect(threadData?.exportedMessageRepository?.headId).toBe(continuation.id);
        expect(threadData?.exportedMessageRepository?.messages).toHaveLength(2);
        expect(
            threadData?.exportedMessageRepository?.messages[0]?.message.content[0]
        ).toMatchObject({
            toolCallId: "terminated-tool",
            result: {success: false, error: "User terminated the operation"},
            isError: true
        });
    });

    test("queues continuation persistence behind an in-flight termination update", async () => {
        const unresolvedMessage = terminatedAssistantMessage();
        if (unresolvedMessage.role !== "assistant") throw new Error("Expected assistant message");
        const unresolvedPart = unresolvedMessage.content[0];
        if (!unresolvedPart || unresolvedPart.type !== "tool-call") {
            throw new Error("Expected tool call");
        }
        const unresolvedRepository: ExportedMessageRepository = {
            headId: unresolvedMessage.id,
            messages: [
                {
                    message: {
                        ...unresolvedMessage,
                        status: {type: "requires-action", reason: "tool-calls"},
                        content: [{...unresolvedPart, result: undefined, isError: undefined}]
                    } as ThreadMessage,
                    parentId: null
                }
            ]
        };
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: createThread(unresolvedRepository),
            result: undefined
        }));

        const terminationEntered = deferred();
        const releaseTermination = deferred();
        const termination = ThreadStore.updateThread("thread-1", async (threadData) => {
            terminationEntered.resolve();
            await releaseTermination.promise;
            return {
                type: "save" as const,
                threadData: createThread({
                    ...threadData!.exportedMessageRepository!,
                    messages: [
                        {
                            message: terminatedAssistantMessage(),
                            parentId: null
                        }
                    ]
                }),
                result: undefined
            };
        });
        await terminationEntered.promise;

        const continuation = continuationMessage();
        const append = new LocalThreadHistoryAdapter("thread-1").append({
            message: continuation,
            parentId: unresolvedMessage.id
        });
        releaseTermination.resolve();
        await Promise.all([termination, append]);

        const threadData = await ThreadStore.loadThread("thread-1");
        expect(threadData?.exportedMessageRepository?.headId).toBe(continuation.id);
        expect(
            threadData?.exportedMessageRepository?.messages[0]?.message.content[0]
        ).toMatchObject({
            toolCallId: "terminated-tool",
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("upserts an existing message and rejects an absent thread", async () => {
        const initial = continuationMessage();
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: createThread({
                headId: initial.id,
                messages: [{message: initial, parentId: null}]
            }),
            result: undefined
        }));

        const updated = {
            ...initial,
            content: [{type: "text" as const, text: "Updated"}]
        } as ThreadMessage;
        const adapter = new LocalThreadHistoryAdapter("thread-1");
        await adapter.append({message: updated, parentId: null});

        const threadData = await ThreadStore.loadThread("thread-1");
        expect(threadData?.exportedMessageRepository?.messages).toHaveLength(1);
        expect(threadData?.exportedMessageRepository?.messages[0]?.message.content).toEqual([
            {type: "text", text: "Updated"}
        ]);
        await expect(
            new LocalThreadHistoryAdapter("missing").append({message: updated, parentId: null})
        ).rejects.toThrow("Thread data not found: missing");
    });

    test("persists load-time recovery before a continuation is appended", async () => {
        const interrupted = terminatedAssistantMessage();
        if (interrupted.role !== "assistant") throw new Error("Expected assistant message");
        const toolCall = interrupted.content[0];
        if (!toolCall || toolCall.type !== "tool-call") throw new Error("Expected tool call");
        const interruptedMessage = {
            ...interrupted,
            status: {type: "running"},
            content: [{...toolCall, result: undefined, isError: undefined}]
        } as ThreadMessage;
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: createThread({
                headId: interruptedMessage.id,
                messages: [{message: interruptedMessage, parentId: null}]
            }),
            result: undefined
        }));

        const adapter = new LocalThreadHistoryAdapter("thread-1");
        await adapter.load();
        const continuation = continuationMessage();
        await adapter.append({message: continuation, parentId: interruptedMessage.id});

        const stored = await ThreadStore.loadThread("thread-1");
        expect(stored?.exportedMessageRepository?.messages[0]?.message).toMatchObject({
            status: {type: "incomplete", reason: "cancelled"},
            content: [
                {
                    result: {
                        success: false,
                        error: expect.stringContaining("closed or reloaded")
                    },
                    isError: true
                }
            ]
        });
        expect(stored?.exportedMessageRepository?.headId).toBe(continuation.id);
    });
});
