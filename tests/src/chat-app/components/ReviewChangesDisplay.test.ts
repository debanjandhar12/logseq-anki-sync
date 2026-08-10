import type {ThreadMessage, ThreadRuntime} from "@assistant-ui/react";
import {afterEach, describe, expect, test, vi} from "vitest";
import {
    getReviewChangesCommandCount,
    getReviewChangesLifecycleLabel,
    getReviewChangesSummary,
    revertAndDiscardReviewChanges,
    revertAndKeepReviewChanges
} from "../../../../src/chat-app/components/ReviewChangesDisplay";
import {ChatToolResponse} from "../../../../src/chat-app/tools/base/ChatToolResponse";
import {LogseqClearUncommittedChangesTool} from "../../../../src/chat-app/tools/impl/LogseqClearUncommittedChangesTool";
import {createLogseqReversibleTransactionTrackerArtifact} from "../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    CreatePageCommand,
    DataScriptQueryCommand,
    LogseqReversibleTransactionTracker,
    ReadBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

const PAGE_UUID = "00000000-0000-0000-0000-000000000001";

const createTrackerMessage = (tracker: LogseqReversibleTransactionTracker): ThreadMessage =>
    ({
        id: "message-1",
        role: "assistant",
        createdAt: new Date(),
        status: {type: "complete", reason: "stop"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId: "tool-1",
                toolName: "test_tool",
                args: {},
                argsText: "{}",
                artifact: createLogseqReversibleTransactionTrackerArtifact(tracker)
            }
        ]
    }) as unknown as ThreadMessage;

const createAppliedTracker = (): LogseqReversibleTransactionTracker => {
    const tracker = new LogseqReversibleTransactionTracker({
        appliedCommandCount: 1,
        changedPages: ["page-1", "page-2"]
    });
    tracker.addCommand(
        new CreatePageCommand({pageName: "Applied"}, {status: "executed", pageUuid: PAGE_UUID})
    );
    return tracker;
};

const createUnappliedTracker = (): LogseqReversibleTransactionTracker => {
    const tracker = new LogseqReversibleTransactionTracker({changedPages: ["page-1"]});
    tracker.addCommand(new CreatePageCommand({pageName: "Ready for review"}));
    return tracker;
};

const createRuntime = (
    messages: readonly ThreadMessage[],
    isRunning = false,
    onCancel?: () => void
) => {
    const state = {messages, isRunning};
    return {
        getState: vi.fn(() => state),
        append: vi.fn(),
        cancelRun: vi.fn(() => {
            state.isRunning = false;
            onCancel?.();
        })
    } as unknown as ThreadRuntime;
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const getAppendedToolCall = (runtime: ThreadRuntime) => {
    const append = vi.mocked(runtime.append);
    const message = append.mock.calls.at(-1)?.[0];
    const part =
        message && typeof message === "object" && "content" in message
            ? message.content[0]
            : undefined;
    if (!part || part.type !== "tool-call") throw new Error("Expected a synthetic tool call");
    return part;
};

describe("ReviewChangesDisplay", () => {
    test("returns an empty summary without a tracker artifact", () => {
        expect(getReviewChangesCommandCount([])).toBe(0);
        expect(getReviewChangesSummary([])).toEqual({commandCount: 0, changedPageCount: 0});
        expect(getReviewChangesLifecycleLabel([])).toBeNull();
    });

    test("ignores trackers containing only read-only commands", () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new ReadBlockCommand({uuid: PAGE_UUID}));
        tracker.addCommand(
            new DataScriptQueryCommand({datalogString: "[:find ?b :where [?b :block/uuid]]"})
        );
        const messages = [createTrackerMessage(tracker)];

        expect(getReviewChangesSummary(messages)).toEqual({commandCount: 0, changedPageCount: 0});
        expect(getReviewChangesLifecycleLabel(messages)).toBeNull();
    });

    test("reports applied graph changes and changed-page counts", () => {
        const messages = [createTrackerMessage(createAppliedTracker())];

        expect(getReviewChangesSummary(messages)).toEqual({commandCount: 1, changedPageCount: 2});
        expect(getReviewChangesLifecycleLabel(messages)).toBe("Applied uncommitted changes");
    });

    test("reports retained but not applied uncommitted changes", () => {
        const messages = [createTrackerMessage(createUnappliedTracker())];

        expect(getReviewChangesSummary(messages)).toEqual({commandCount: 1, changedPageCount: 1});
        expect(getReviewChangesLifecycleLabel(messages)).toBe("Not applied uncommitted changes");
    });

    test("reverts applied uncommitted changes while retaining their commands", async () => {
        vi.stubGlobal("logseq", {
            Editor: {
                getPage: vi.fn(async () => ({uuid: PAGE_UUID})),
                deletePage: vi.fn(async () => undefined)
            }
        });
        const runtime = createRuntime([createTrackerMessage(createAppliedTracker())], true);
        let persistedTracker: LogseqReversibleTransactionTracker | undefined;
        const persistTrackerArtifact = vi.fn(
            async ({tracker}: {tracker: LogseqReversibleTransactionTracker}) => {
                persistedTracker = tracker;
            }
        );

        await expect(
            revertAndKeepReviewChanges("thread-1", runtime, {
                notify: vi.fn(async () => undefined),
                persistTrackerArtifact
            })
        ).resolves.toBe("retained");

        expect(runtime.cancelRun).not.toHaveBeenCalled();
        expect(runtime.append).not.toHaveBeenCalled();
        expect(persistTrackerArtifact).toHaveBeenCalledOnce();
        expect(persistedTracker?.getCommands()).toHaveLength(1);
        expect(persistedTracker?.getAppliedCommandCount()).toBe(0);
    });

    test("leaves already-not-applied uncommitted changes untouched", async () => {
        const getPage = vi.fn();
        vi.stubGlobal("logseq", {Editor: {getPage}});
        const tracker = createUnappliedTracker();
        const runtime = createRuntime([createTrackerMessage(tracker)]);
        let persistedTracker: LogseqReversibleTransactionTracker | undefined;
        const persistTrackerArtifact = vi.fn(
            async ({tracker}: {tracker: LogseqReversibleTransactionTracker}) => {
                persistedTracker = tracker;
            }
        );

        await expect(
            revertAndKeepReviewChanges("thread-1", runtime, {
                notify: vi.fn(async () => undefined),
                persistTrackerArtifact
            })
        ).resolves.toBe("retained");

        expect(getPage).not.toHaveBeenCalled();
        expect(runtime.append).not.toHaveBeenCalled();
        expect(persistedTracker?.getCommands()).toHaveLength(1);
        expect(persistedTracker?.getAppliedCommandCount()).toBe(0);
    });

    test("clears unsafe state and reports a partial revert failure", async () => {
        vi.stubGlobal("logseq", {
            Editor: {getPage: vi.fn(async () => Promise.reject(new Error("revert failed")))},
            UI: {showMsg: vi.fn(async () => undefined)}
        });
        const notify = vi.fn(async () => undefined);
        const runtime = createRuntime([createTrackerMessage(createAppliedTracker())]);
        let persistedTracker: LogseqReversibleTransactionTracker | undefined;
        const persistTrackerArtifact = vi.fn(
            async ({tracker}: {tracker: LogseqReversibleTransactionTracker}) => {
                persistedTracker = tracker;
            }
        );

        await expect(
            revertAndKeepReviewChanges("thread-1", runtime, {notify, persistTrackerArtifact})
        ).resolves.toBe("discarded");

        expect(notify).toHaveBeenCalledWith(
            "Failed to revert applied uncommitted changes: revert failed. Uncommitted changes were discarded."
        );
        expect(runtime.append).not.toHaveBeenCalled();
        expect(persistedTracker?.getCommands()).toEqual([]);
    });

    test("stops an active run before confirmation and leaves state untouched when dismissed", async () => {
        const order: string[] = [];
        const runtime = createRuntime([createTrackerMessage(createAppliedTracker())], true, () => {
            order.push("cancel-run");
        });
        const showConfirm = vi.fn(async () => {
            order.push("confirm");
            return false;
        });
        const stopThread = vi.fn(async () => {
            runtime.cancelRun();
            order.push("wait");
            return {didStop: true, kind: "active-run" as const};
        });
        const createDiscardTool = vi.fn();
        await expect(
            revertAndDiscardReviewChanges("thread-1", runtime, {
                createDiscardTool,
                showConfirm,
                stopThread
            })
        ).resolves.toBe(false);

        expect(order).toEqual(["cancel-run", "wait", "confirm"]);
        expect(showConfirm).toHaveBeenCalledWith(
            "Revert applied uncommitted changes and discard all uncommitted changes?",
            {confirmText: "Revert and discard", cancelText: "Keep uncommitted changes"}
        );
        expect(stopThread).toHaveBeenCalledOnce();
        expect(createDiscardTool).not.toHaveBeenCalled();
        expect(runtime.append).not.toHaveBeenCalled();
        expect(runtime.cancelRun).toHaveBeenCalledOnce();
    });

    test("cancels pending calls after confirmation and invokes the discard tool", async () => {
        const order: string[] = [];
        const runtime = createRuntime([createTrackerMessage(createAppliedTracker())]);
        const output = ChatToolResponse.success(
            {},
            createLogseqReversibleTransactionTrackerArtifact(
                new LogseqReversibleTransactionTracker()
            )
        );
        const execute = vi.fn(
            async (args: Record<string, never>, context: {messages: readonly ThreadMessage[]}) => {
                order.push("execute");
                expect(args).toEqual({});
                expect(context.messages).toHaveLength(1);
                return output;
            }
        );
        const discardTool = {execute} as unknown as LogseqClearUncommittedChangesTool;

        await expect(
            revertAndDiscardReviewChanges("thread-1", runtime, {
                stopThread: vi.fn(async () => {
                    order.push("cancel-pending");
                    return {didStop: true, kind: "required-action" as const};
                }),
                createDiscardTool: () => discardTool,
                showConfirm: vi.fn(async () => true)
            })
        ).resolves.toBe(true);

        expect(order).toEqual(["cancel-pending", "execute"]);
        const toolCall = getAppendedToolCall(runtime);
        expect(toolCall.toolName).toBe(LogseqClearUncommittedChangesTool.NAME);
        expect(toolCall.args).toEqual({});
    });
});
