import type {ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {getPendingLogseqChangesCommandCount} from "../../../../src/chat-app/components/PendingLogseqChangesDisplay";
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
    });

    test("returns zero when the latest tracker has no changed pages", () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName: "Pending"}));

        expect(getPendingLogseqChangesCommandCount([createTrackerMessage(tracker)])).toBe(0);
    });

    test("counts every command when the latest tracker has changed pages", () => {
        const tracker = new LogseqReversibleTransactionTracker({changedPages: ["page-uuid"]});
        tracker.addCommand(new ReadBlockCommand({uuid: "block-uuid"}));
        tracker.addCommand(
            new DataScriptQueryCommand({datalogString: "[:find ?b :where [?b :block/uuid]]"})
        );
        tracker.addCommand(new CreatePageCommand({pageName: "Pending"}));

        expect(getPendingLogseqChangesCommandCount([createTrackerMessage(tracker)])).toBe(3);
    });
});
