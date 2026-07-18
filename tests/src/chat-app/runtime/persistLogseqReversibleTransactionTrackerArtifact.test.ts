import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {patchLogseqReversibleTransactionTrackerArtifact} from "../../../../src/chat-app/runtime/persistLogseqReversibleTransactionTrackerArtifact";
import {LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE} from "../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    CreatePageCommand,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "../../../../src/core/logseq-reversible-transaction-tracker";

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
