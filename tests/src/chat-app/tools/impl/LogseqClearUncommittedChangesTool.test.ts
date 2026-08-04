import type {ThreadMessage} from "@assistant-ui/react";
import {afterEach, describe, expect, test, vi} from "vitest";
import {LogseqClearUncommittedChangesTool} from "../../../../../src/chat-app/tools/impl/LogseqClearUncommittedChangesTool";
import {createLogseqReversibleTransactionTrackerArtifact} from "../../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    CreatePageCommand,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "../../../../../src/core/logseq-reversible-transaction-tracker";

const PAGE_UUID = "00000000-0000-0000-0000-000000000002";

const createMessage = (tracker: LogseqReversibleTransactionTracker): ThreadMessage =>
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

const getTrackerFromResponse = (response: {artifact?: unknown}) => {
    const artifact = response.artifact as Record<string, any>;
    return LogseqReversibleTransactionTrackerSerializer.deserialize(
        artifact.LogseqReversibleTransactionTracker.LogseqReversibleTransactionTracker
    );
};

describe("LogseqClearUncommittedChangesTool", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test("uses the renamed discard tool ID and clears review state", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName: "Review"}));

        const response = await new LogseqClearUncommittedChangesTool().execute(
            {},
            {
                messages: [createMessage(tracker)]
            }
        );

        expect(LogseqClearUncommittedChangesTool.NAME).toBe("logseq_clear_uncommitted_changes");
        expect(response.result).toEqual({success: true});
        expect(getTrackerFromResponse(response).getCommands()).toEqual([]);
    });

    test("clears unsafe state and reports a warning when reversion fails", async () => {
        const tracker = new LogseqReversibleTransactionTracker({appliedCommandCount: 1});
        tracker.addCommand(
            new CreatePageCommand({pageName: "Review"}, {status: "executed", pageUuid: PAGE_UUID})
        );
        const showMsg = vi.fn(async () => undefined);
        vi.stubGlobal("logseq", {
            Editor: {getPage: vi.fn(async () => Promise.reject(new Error("revert failed")))},
            UI: {showMsg}
        });

        const response = await new LogseqClearUncommittedChangesTool().execute(
            {},
            {
                messages: [createMessage(tracker)]
            }
        );

        expect(response.result).toEqual({
            success: true,
            warning:
                "Failed to revert review changes: revert failed. Review changes were discarded."
        });
        expect(showMsg).toHaveBeenCalledWith(
            "Failed to revert review changes: revert failed. Review changes were discarded.",
            "error"
        );
        expect(getTrackerFromResponse(response).getCommands()).toEqual([]);
    });
});
