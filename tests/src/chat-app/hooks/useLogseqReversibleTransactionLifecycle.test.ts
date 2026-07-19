import {describe, expect, test} from "vitest";
import {
    didActiveConversationChange,
    isThreadBusyForTransactionRevert
} from "../../../../src/chat-app/hooks/useLogseqReversibleTransactionLifecycle";

describe("didActiveConversationChange", () => {
    test("detects thread switches", () => {
        expect(
            didActiveConversationChange(
                {threadId: "thread-1", branchMessageIds: ["message-1"]},
                {threadId: "thread-2", branchMessageIds: ["message-1"]}
            )
        ).toBe(true);
    });

    test("detects branch switches while ignoring messages appended to the active branch", () => {
        expect(
            didActiveConversationChange(
                {threadId: "thread-1", branchMessageIds: ["root", "branch-a"]},
                {threadId: "thread-1", branchMessageIds: ["root", "branch-b"]}
            )
        ).toBe(true);
        expect(
            didActiveConversationChange(
                {threadId: "thread-1", branchMessageIds: ["root", "branch-a"]},
                {
                    threadId: "thread-1",
                    branchMessageIds: ["root", "branch-a", "new-message"]
                }
            )
        ).toBe(false);
    });

    test("detects switching to a shorter branch", () => {
        expect(
            didActiveConversationChange(
                {
                    threadId: "thread-1",
                    branchMessageIds: ["root", "branch-a", "message-3"]
                },
                {threadId: "thread-1", branchMessageIds: ["root", "branch-a"]}
            )
        ).toBe(true);
    });
});

describe("isThreadBusyForTransactionRevert", () => {
    test("treats running threads as busy", () => {
        expect(
            isThreadBusyForTransactionRevert({
                isRunning: true,
                lastMessageStatusType: "complete"
            })
        ).toBe(true);
    });

    test("treats requires-action as busy", () => {
        expect(
            isThreadBusyForTransactionRevert({
                isRunning: false,
                lastMessageStatusType: "requires-action"
            })
        ).toBe(true);
    });

    test("treats idle non-action states as safe for scheduled revert", () => {
        expect(
            isThreadBusyForTransactionRevert({
                isRunning: false,
                lastMessageStatusType: "complete"
            })
        ).toBe(false);
    });
});
