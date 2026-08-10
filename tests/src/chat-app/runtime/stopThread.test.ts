import type {ExportedMessageRepository, ThreadMessage, ThreadRuntime} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {stopThread} from "../../../../src/chat-app/runtime/stopThread";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";

vi.mock("../../../../src/core/stores/thread-store/ThreadStore", () => ({
    ThreadStore: {
        loadThread: vi.fn(),
        saveThread: vi.fn()
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
    return {runtime, getRepository: () => repository};
}

describe("stopThread", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ThreadStore.loadThread).mockResolvedValue({
            remoteId: "thread-1",
            status: "regular",
            custom: {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByPluginVersion: "test"
            }
        });
        vi.mocked(ThreadStore.saveThread).mockResolvedValue(undefined);
    });

    test("waits for active cancellation, then adds the generic tool failure", async () => {
        const {runtime, getRepository} = createRuntime("running");

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
        expect(ThreadStore.saveThread).toHaveBeenCalledOnce();
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
        expect(ThreadStore.saveThread).not.toHaveBeenCalled();
    });

    test("keeps the live runtime terminal and reports persistence failure", async () => {
        const {runtime, getRepository} = createRuntime("requires-action");
        vi.mocked(ThreadStore.loadThread).mockResolvedValue(null);

        await expect(stopThread({threadId: "thread-1", runtime})).resolves.toEqual({
            didStop: true,
            kind: "required-action",
            persistenceFailed: true
        });

        expect(getRepository().messages[0]?.message.status).toEqual({
            type: "incomplete",
            reason: "cancelled"
        });
    });

    test("shares identical stops but reports conflicting semantics as not applied", async () => {
        const {runtime} = createRuntime("requires-action");
        let releaseSave: (() => void) | undefined;
        vi.mocked(ThreadStore.saveThread).mockImplementation(
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
        expect(ThreadStore.saveThread).toHaveBeenCalledOnce();
    });
});
