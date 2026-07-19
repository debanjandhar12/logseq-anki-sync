import type {ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {
    getPendingLogseqChangesCommandCount,
    getPendingLogseqChangesSummary
} from "../../../../src/chat-app/components/PendingLogseqChangesDisplay";
import {createLogseqReversibleTransactionTrackerArtifact} from "../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    CreatePageCommand,
    DataScriptQueryCommand,
    LogseqReversibleTransactionTracker,
    ReadBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

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

describe("getPendingLogseqChangesCommandCount", () => {
    test("returns zero when there is no tracker artifact", () => {
        expect(getPendingLogseqChangesCommandCount([])).toBe(0);
        expect(getPendingLogseqChangesSummary([])).toEqual({commandCount: 0, changedPageCount: 0});
    });

    test("returns zero when the latest tracker has no graph-mutating commands", () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new ReadBlockCommand({uuid: "block-uuid"}));
        tracker.addCommand(
            new DataScriptQueryCommand({datalogString: "[:find ?b :where [?b :block/uuid]]"})
        );

        expect(getPendingLogseqChangesCommandCount([createTrackerMessage(tracker)])).toBe(0);
        expect(getPendingLogseqChangesSummary([createTrackerMessage(tracker)])).toEqual({
            commandCount: 0,
            changedPageCount: 0
        });
    });

    test("counts only graph-mutating commands and reports changed pages", () => {
        const tracker = new LogseqReversibleTransactionTracker({
            changedPages: ["page-uuid", "other-page-uuid"]
        });
        tracker.addCommand(new ReadBlockCommand({uuid: "block-uuid"}));
        tracker.addCommand(
            new DataScriptQueryCommand({datalogString: "[:find ?b :where [?b :block/uuid]]"})
        );
        tracker.addCommand(new CreatePageCommand({pageName: "Pending"}));

        expect(getPendingLogseqChangesCommandCount([createTrackerMessage(tracker)])).toBe(1);
        expect(getPendingLogseqChangesSummary([createTrackerMessage(tracker)])).toEqual({
            commandCount: 1,
            changedPageCount: 2
        });
    });
});
