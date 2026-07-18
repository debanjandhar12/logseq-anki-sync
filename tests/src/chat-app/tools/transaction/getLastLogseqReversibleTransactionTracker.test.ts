import type {ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {createLogseqReversibleTransactionTrackerArtifact} from "../../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    findLastLogseqReversibleTransactionTracker,
    getLastLogseqReversibleTransactionTracker
} from "../../../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {
    CreatePageCommand,
    LogseqReversibleTransactionTracker
} from "../../../../../src/core/logseq-reversible-transaction-tracker";

const createTrackerMessage = (
    messageId: string,
    toolCallId: string,
    tracker: LogseqReversibleTransactionTracker
): ThreadMessage =>
    ({
        id: messageId,
        role: "assistant",
        createdAt: new Date(),
        status: {type: "complete", reason: "stop"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId,
                toolName: "test_tool",
                args: {},
                argsText: "{}",
                artifact: createLogseqReversibleTransactionTrackerArtifact(tracker)
            }
        ]
    }) as unknown as ThreadMessage;

describe("findLastLogseqReversibleTransactionTracker", () => {
    test("returns the latest tracker with its exact artifact location", () => {
        const firstTracker = new LogseqReversibleTransactionTracker();
        firstTracker.addCommand(new CreatePageCommand({pageName: "First"}));
        const latestTracker = new LogseqReversibleTransactionTracker();
        latestTracker.addCommand(new CreatePageCommand({pageName: "Latest"}));

        const located = findLastLogseqReversibleTransactionTracker([
            createTrackerMessage("message-1", "tool-1", firstTracker),
            createTrackerMessage("message-2", "tool-2", latestTracker)
        ]);

        expect(located?.messageId).toBe("message-2");
        expect(located?.toolCallId).toBe("tool-2");
        expect(located?.tracker.getCommands()[0]?.args).toEqual({pageName: "Latest"});
    });

    test("keeps the tracker-only fallback for callers without artifacts", () => {
        expect(findLastLogseqReversibleTransactionTracker([])).toBeNull();
        expect(getLastLogseqReversibleTransactionTracker([]).getCommands()).toEqual([]);
    });
});
