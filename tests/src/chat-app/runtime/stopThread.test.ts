import type {ExportedMessageRepository, ThreadMessage, ThreadRuntime} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {stopThread} from "../../../../src/chat-app/runtime/stopThread";
import {trackThreadRun} from "../../../../src/chat-app/runtime/ThreadRunLifecycle";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";

vi.mock("../../../../src/core/stores/thread-store/ThreadStore", () => ({
    ThreadStore: {
        updateThread: vi.fn()
    }
}));

function assistantMessage(status: "running" | "requires-action" | "incomplete"): ThreadMessage {
    return {
        id: "assistant-message",
        role: "assistant",
        createdAt: new Date(),
        status:
            status === "running"
                ? {type: "running"}
                : status === "requires-action"
                  ? {type: "requires-action", reason: "tool-calls"}
                  : {type: "incomplete", reason: "cancelled"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId: "tool-call",
                toolName: "test_tool",
                args: {},
                argsText: "{}"
            }
        ]
    } as unknown as ThreadMessage;
}

function createRuntime(initialStatus: "running" | "requires-action") {
    let repository: ExportedMessageRepository = {
        headId: "assistant-message",
        messages: [{message: assistantMessage(initialStatus), parentId: null}]
    };
    let running = initialStatus === "running";
    const runEndListeners = new Set<() => void>();
    const runtime = {
        export: vi.fn(() => repository),
        import: vi.fn((next: ExportedMessageRepository) => {
            repository = next;
            running = false;
        }),
        getState: vi.fn(() => ({
            isRunning: running,
            messages: repository.messages.map(({message}) => message)
        })),
        unstable_on: vi.fn((_event: string, callback: () => void) => {
            runEndListeners.add(callback);
            return () => runEndListeners.delete(callback);
        }),
        cancelRun: vi.fn(() => {
            repository = {
                ...repository,
                messages: [
                    {
                        ...repository.messages[0]!,
                        message: assistantMessage("incomplete")
                    }
                ]
            };
            running = false;
            for (const listener of [...runEndListeners]) listener();
        })
    } as unknown as ThreadRuntime;
    return {
        runtime,
        getRepository: () => repository,
        emitRunEnd: () => {
            for (const listener of [...runEndListeners]) listener();
        }
    };
}

describe("stopThread", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: "assistant-message",
                    messages: [{message: assistantMessage("requires-action"), parentId: null}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            return update.result;
        });
    });

    test("waits for active cancellation, then adds the generic tool failure", async () => {
        const {runtime, getRepository} = createRuntime("running");
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: "assistant-message",
                    messages: [{message: assistantMessage("incomplete"), parentId: null}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "active-run"
        });

        expect(runtime.unstable_on).toHaveBeenCalledBefore(runtime.cancelRun as never);
        expect(runtime.cancelRun).toHaveBeenCalledOnce();
        expect(getRepository().messages[0]?.message).toMatchObject({
            status: {type: "incomplete", reason: "cancelled"},
            content: [
                expect.objectContaining({
                    result: {success: false, error: "User terminated the operation"},
                    isError: true
                })
            ]
        });
        expect(ThreadStore.updateThread).toHaveBeenCalledOnce();
        expect(persistedRepository?.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"},
            isError: true
        });
    });

    test("preserves a continuation that persisted before the termination update", async () => {
        const {runtime} = createRuntime("requires-action");
        const continuation = {
            id: "continuation",
            role: "user",
            createdAt: new Date(),
            content: [{type: "text", text: "Continue"}],
            attachments: [],
            metadata: {custom: {}}
        } as unknown as ThreadMessage;
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: continuation.id,
                    messages: [
                        {message: assistantMessage("requires-action"), parentId: null},
                        {message: continuation, parentId: "assistant-message"}
                    ]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await stopThread({threadId: "thread-1", runtime});

        expect(persistedRepository?.headId).toBe(continuation.id);
        expect(persistedRepository?.messages).toHaveLength(2);
        expect(persistedRepository?.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("restores a missing persisted parent chain without removing newer messages", async () => {
        const {runtime} = createRuntime("requires-action");
        const continuation = {
            id: "continuation",
            role: "user",
            createdAt: new Date(),
            content: [{type: "text", text: "Continue"}],
            attachments: [],
            metadata: {custom: {}}
        } as unknown as ThreadMessage;
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: continuation.id,
                    messages: [{message: continuation, parentId: "assistant-message"}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "required-action"
        });

        expect(persistedRepository?.headId).toBe(continuation.id);
        expect(persistedRepository?.messages.map(({message}) => message.id)).toEqual([
            "assistant-message",
            "continuation"
        ]);
        expect(persistedRepository?.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("restores a missing ancestor when the persisted target already exists", async () => {
        const userMessage = {
            id: "user-message",
            role: "user",
            createdAt: new Date(),
            content: [{type: "text", text: "Run a tool"}],
            attachments: [],
            metadata: {custom: {}}
        } as unknown as ThreadMessage;
        const assistant = assistantMessage("requires-action");
        let repository: ExportedMessageRepository = {
            headId: assistant.id,
            messages: [
                {message: userMessage, parentId: null},
                {message: assistant, parentId: userMessage.id}
            ]
        };
        const runtime = {
            export: vi.fn(() => repository),
            import: vi.fn((next: ExportedMessageRepository) => {
                repository = next;
            }),
            getState: vi.fn(() => ({
                isRunning: false,
                messages: repository.messages.map(({message}) => message)
            }))
        } as unknown as ThreadRuntime;
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: assistant.id,
                    messages: [{message: assistant, parentId: userMessage.id}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await stopThread({threadId: "thread-1", runtime});

        expect(persistedRepository?.messages.map(({message}) => message.id)).toEqual([
            userMessage.id,
            assistant.id
        ]);
        expect(persistedRepository?.messages[1]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("does not restore unrelated runtime branches", async () => {
        const {runtime} = createRuntime("requires-action");
        const exported = runtime.export();
        const unrelated = {
            ...assistantMessage("incomplete"),
            id: "unrelated-branch"
        } as ThreadMessage;
        runtime.import({
            ...exported,
            messages: [...exported.messages, {message: unrelated, parentId: null}]
        });
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: "assistant-message",
                    messages: [{message: assistantMessage("requires-action"), parentId: null}]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await stopThread({threadId: "thread-1", runtime});

        expect(persistedRepository?.messages.map(({message}) => message.id)).toEqual([
            "assistant-message"
        ]);
    });

    test("terminates an unresolved stored target after the stored head switches branches", async () => {
        const {runtime} = createRuntime("requires-action");
        const otherBranch = {
            ...assistantMessage("incomplete"),
            id: "other-branch"
        } as ThreadMessage;
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                exportedMessageRepository: {
                    headId: otherBranch.id,
                    messages: [
                        {message: assistantMessage("requires-action"), parentId: null},
                        {message: otherBranch, parentId: null}
                    ]
                },
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await stopThread({threadId: "thread-1", runtime});

        expect(persistedRepository?.headId).toBe(otherBranch.id);
        expect(persistedRepository?.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"},
            isError: true
        });
        expect(persistedRepository?.messages[1]?.message.id).toBe(otherBranch.id);
    });

    test("writes only target ancestry when creating a missing thread", async () => {
        const {runtime} = createRuntime("requires-action");
        const exported = runtime.export();
        runtime.import({
            ...exported,
            messages: [
                ...exported.messages,
                {
                    message: {
                        ...assistantMessage("incomplete"),
                        id: "unrelated-branch"
                    } as ThreadMessage,
                    parentId: null
                }
            ]
        });
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater(null);
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await stopThread({threadId: "thread-1", runtime});

        expect(persistedRepository?.messages.map(({message}) => message.id)).toEqual([
            "assistant-message"
        ]);
    });

    test("persists the terminated runtime repository when stored history is empty", async () => {
        const {runtime} = createRuntime("requires-action");
        let persistedRepository: ExportedMessageRepository | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater({
                remoteId: "thread-1",
                status: "regular",
                custom: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdByPluginVersion: "test"
                }
            });
            if (update.type === "save") {
                persistedRepository = update.threadData.exportedMessageRepository;
            }
            return update.result;
        });

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "required-action"
        });
        expect(persistedRepository?.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("terminates settled required actions without cancelling a nonexistent run", async () => {
        const {runtime, getRepository} = createRuntime("requires-action");

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "required-action"
        });

        expect(runtime.cancelRun).not.toHaveBeenCalled();
        expect(getRepository().messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"}
        });
    });

    test("cancels a tracked run even when public state says requires-action", async () => {
        const {runtime, emitRunEnd} = createRuntime("requires-action");
        const endRun = trackThreadRun("thread-1");
        vi.mocked(runtime.cancelRun).mockImplementation(() => {
            endRun();
            emitRunEnd();
        });

        try {
            const stop = stopThread({threadId: "thread-1", runtime});
            await vi.waitFor(() => expect(runtime.cancelRun).toHaveBeenCalledOnce());
            await stop;
        } finally {
            endRun();
        }

        expect(runtime.cancelRun).toHaveBeenCalledOnce();
    });

    test("uses an exact target and custom Continue Later message", async () => {
        const {runtime, getRepository} = createRuntime("requires-action");

        await stopThread({
            threadId: "thread-1",
            runtime,
            target: {
                messageId: "assistant-message",
                toolCallId: "tool-call",
                toolName: "test_tool"
            },
            errorMessage: "Commit later"
        });

        expect(getRepository().messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "Commit later"}
        });
    });

    test("reports a stale exact target as not stopped", async () => {
        const {runtime} = createRuntime("requires-action");

        await expect(
            stopThread({
                threadId: "thread-1",
                runtime,
                target: {messageId: "assistant-message", toolCallId: "stale"}
            })
        ).resolves.toEqual({didStop: false, kind: "nothing-to-stop"});

        expect(runtime.import).not.toHaveBeenCalled();
        expect(ThreadStore.updateThread).not.toHaveBeenCalled();
    });

    test("creates a missing thread record from the terminated runtime state", async () => {
        const {runtime, getRepository} = createRuntime("requires-action");
        let savedThread: unknown;
        vi.mocked(ThreadStore.updateThread).mockImplementation(async (_threadId, updater) => {
            const update = await updater(null);
            if (update.type === "save") savedThread = update.threadData;
            return update.result;
        });

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "required-action"
        });

        expect(getRepository().messages[0]?.message.status).toEqual({
            type: "incomplete",
            reason: "cancelled"
        });
        expect(savedThread).toMatchObject({
            remoteId: "thread-1",
            status: "regular",
            exportedMessageRepository: {
                headId: "assistant-message",
                messages: [
                    {
                        message: {
                            content: [
                                expect.objectContaining({
                                    result: {
                                        success: false,
                                        error: "User terminated the operation"
                                    }
                                })
                            ]
                        }
                    }
                ]
            }
        });
    });

    test("shares identical stops but reports conflicting semantics as not applied", async () => {
        const {runtime} = createRuntime("requires-action");
        let releaseSave: (() => void) | undefined;
        vi.mocked(ThreadStore.updateThread).mockImplementation(
            () => new Promise<void>((resolve) => (releaseSave = resolve))
        );

        const first = stopThread({threadId: "thread-1", runtime});
        const duplicate = stopThread({threadId: "thread-1", runtime});
        const conflicting = stopThread({
            threadId: "thread-1",
            runtime,
            target: {
                messageId: "assistant-message",
                toolCallId: "tool-call",
                toolName: "test_tool"
            },
            errorMessage: "Commit later"
        });
        await vi.waitFor(() => expect(releaseSave).toBeTypeOf("function"));
        releaseSave?.();

        await expect(first).resolves.toEqual({didStop: true, kind: "required-action"});
        await expect(duplicate).resolves.toEqual({didStop: true, kind: "required-action"});
        await expect(conflicting).resolves.toEqual({didStop: false, kind: "nothing-to-stop"});
        expect(ThreadStore.updateThread).toHaveBeenCalledOnce();
    });
});
