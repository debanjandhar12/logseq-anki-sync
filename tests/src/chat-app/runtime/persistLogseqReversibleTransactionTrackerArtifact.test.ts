import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {
    patchLogseqReversibleTransactionTrackerArtifact,
    persistLogseqReversibleTransactionTrackerArtifact
} from "../../../../src/chat-app/runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE} from "../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    CreatePageCommand,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager/LogseqPluginStorageManager";

const createMessage = (id: string, toolCallId: string): ThreadMessage =>
    ({
        id,
        role: "assistant",
        createdAt: new Date(),
        status: {type: "complete", reason: "stop"},
        metadata: {custom: {}},
        content: [
            {type: "text", text: "unchanged"},
            {
                type: "tool-call",
                toolCallId,
                toolName: "test_tool",
                args: {},
                argsText: "{}",
                artifact: {otherArtifact: {value: true}}
            }
        ]
    }) as unknown as ThreadMessage;

describe("patchLogseqReversibleTransactionTrackerArtifact", () => {
    test("patches only the exact tool call and preserves branches and other artifacts", () => {
        const repository: ExportedMessageRepository = {
            headId: "branch-message",
            messages: [
                {message: createMessage("root-message", "root-tool"), parentId: null},
                {
                    message: createMessage("branch-message", "branch-tool"),
                    parentId: "root-message"
                },
                {
                    message: createMessage("other-branch", "other-tool"),
                    parentId: "root-message"
                }
            ]
        };
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName: "Patched"}));

        const patched = patchLogseqReversibleTransactionTrackerArtifact(
            repository,
            {messageId: "branch-message", toolCallId: "branch-tool"},
            tracker
        );

        expect(patched.headId).toBe("branch-message");
        expect(patched.messages[0]).toBe(repository.messages[0]);
        expect(patched.messages[2]).toBe(repository.messages[2]);
        expect(patched.messages[1]?.parentId).toBe("root-message");

        const toolCall = patched.messages[1]?.message.content[1];
        expect(toolCall?.type).toBe("tool-call");
        if (toolCall?.type !== "tool-call") throw new Error("Expected tool call");
        expect(toolCall.artifact).toMatchObject({otherArtifact: {value: true}});

        const artifact = toolCall.artifact as Record<string, any>;
        expect(
            artifact[LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE]
                .LogseqReversibleTransactionTracker
        ).toEqual(LogseqReversibleTransactionTrackerSerializer.serialize(tracker));
    });

    test("rejects a stale artifact location", () => {
        const repository: ExportedMessageRepository = {
            messages: [{message: createMessage("message", "tool"), parentId: null}]
        };

        expect(() =>
            patchLogseqReversibleTransactionTrackerArtifact(
                repository,
                {messageId: "missing", toolCallId: "tool"},
                new LogseqReversibleTransactionTracker()
            )
        ).toThrow("Unable to find tracker artifact");
    });
});

describe("persistLogseqReversibleTransactionTrackerArtifact", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("tracker-artifact-test");
    });

    test("patches the latest stored repository without removing its tool result", async () => {
        const message = createMessage("message", "tool");
        if (message.role !== "assistant") throw new Error("Expected assistant message");
        const toolCall = message.content[1];
        if (toolCall?.type !== "tool-call") throw new Error("Expected tool call");
        const repository: ExportedMessageRepository = {
            headId: message.id,
            messages: [
                {
                    message: {
                        ...message,
                        content: [
                            message.content[0]!,
                            {
                                ...toolCall,
                                result: {
                                    success: false,
                                    error: "User terminated the operation"
                                },
                                isError: true
                            }
                        ]
                    } as ThreadMessage,
                    parentId: null
                }
            ]
        };
        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: {
                remoteId: "thread-1",
                title: "Current title",
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

        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName: "Patched"}));
        await persistLogseqReversibleTransactionTrackerArtifact({
            threadId: "thread-1",
            location: {messageId: "message", toolCallId: "tool"},
            tracker
        });

        const threadData = await ThreadStore.loadThread("thread-1");
        expect(threadData?.title).toBe("Current title");
        expect(
            threadData?.exportedMessageRepository?.messages[0]?.message.content[1]
        ).toMatchObject({
            result: {success: false, error: "User terminated the operation"},
            artifact: {
                [LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE]: expect.any(Object)
            }
        });
    });

    test("skips missing state and rejects a stale location without writing", async () => {
        const setItem = vi.spyOn(LogseqPluginStorageManager.store, "setItem");
        const tracker = new LogseqReversibleTransactionTracker();

        await persistLogseqReversibleTransactionTrackerArtifact({
            threadId: "missing",
            location: {messageId: "message", toolCallId: "tool"},
            tracker
        });
        expect(setItem).not.toHaveBeenCalled();

        await ThreadStore.updateThread("thread-1", () => ({
            type: "save",
            threadData: {
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: "message",
                    messages: [{message: createMessage("message", "tool"), parentId: null}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            },
            result: undefined
        }));
        setItem.mockClear();

        await expect(
            persistLogseqReversibleTransactionTrackerArtifact({
                threadId: "thread-1",
                location: {messageId: "missing", toolCallId: "tool"},
                tracker
            })
        ).rejects.toThrow("Unable to find tracker artifact");
        expect(setItem).not.toHaveBeenCalled();
    });
});
