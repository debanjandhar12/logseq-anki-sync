import type {ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {LogseqCommitChangesTool} from "../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {
    getLatestCommittedTurnBoundary,
    isMessageInCommittedHistory,
    isSuccessfulLogseqCommitToolPart
} from "../../../../src/chat-app/utils/committedTurnBoundary";

function message(
    id: string,
    role: "user" | "assistant",
    content: ThreadMessage["content"] = [{type: "text", text: id}]
): ThreadMessage {
    return {id, role, content} as ThreadMessage;
}

function commitPart(result?: unknown, toolName = LogseqCommitChangesTool.NAME) {
    return {
        type: "tool-call" as const,
        toolCallId: "commit-call",
        toolName,
        args: {},
        argsText: "{}",
        result
    };
}

describe("committedTurnBoundary", () => {
    test.each([
        ["pending", undefined],
        ["malformed", "committed"],
        ["failed", {success: false, outcome: "committed"}],
        ["no changes", {success: true, outcome: "no-changes"}],
        ["legacy untyped", {success: true, changes: "Committed changes successfully."}]
    ])("rejects %s commit results", (_name, result) => {
        expect(isSuccessfulLogseqCommitToolPart(commitPart(result))).toBe(false);
    });

    test("rejects successful results from unrelated tools", () => {
        expect(
            isSuccessfulLogseqCommitToolPart(
                commitPart({success: true, outcome: "committed"}, "another_tool")
            )
        ).toBe(false);
    });

    test("recognizes a typed successful commit result", () => {
        expect(
            isSuccessfulLogseqCommitToolPart(commitPart({success: true, outcome: "committed"}))
        ).toBe(true);
    });

    test("locks the committed turn and earlier history but not the next turn", () => {
        const messages = [
            message("user-a", "user"),
            message("assistant-a", "assistant", [
                commitPart({success: true, outcome: "committed"})
            ]),
            message("assistant-continuation", "assistant"),
            message("user-b", "user"),
            message("assistant-b", "assistant")
        ];

        expect(getLatestCommittedTurnBoundary(messages)).toBe(3);
        expect(isMessageInCommittedHistory(messages, "user-a")).toBe(true);
        expect(isMessageInCommittedHistory(messages, "assistant-a")).toBe(true);
        expect(isMessageInCommittedHistory(messages, "assistant-continuation")).toBe(true);
        expect(isMessageInCommittedHistory(messages, "user-b")).toBe(false);
        expect(isMessageInCommittedHistory(messages, "assistant-b")).toBe(false);
        expect(isMessageInCommittedHistory(messages, "missing")).toBe(false);
    });

    test("uses the latest real commit and ignores a later no-op", () => {
        const messages = [
            message("user-a", "user"),
            message("commit-a", "assistant", [commitPart({success: true, outcome: "committed"})]),
            message("user-b", "user"),
            message("no-op", "assistant", [commitPart({success: true, outcome: "no-changes"})]),
            message("user-c", "user"),
            message("commit-c", "assistant", [commitPart({success: true, outcome: "committed"})])
        ];

        expect(getLatestCommittedTurnBoundary(messages)).toBe(messages.length);
        expect(isMessageInCommittedHistory(messages, "user-c")).toBe(true);
    });

    test("derives boundaries independently from each selected branch", () => {
        const committedBranch = [
            message("user", "user"),
            message("assistant", "assistant", [commitPart({success: true, outcome: "committed"})])
        ];
        const uncommittedBranch = [message("user", "user"), message("assistant-alt", "assistant")];

        expect(isMessageInCommittedHistory(committedBranch, "user")).toBe(true);
        expect(isMessageInCommittedHistory(uncommittedBranch, "user")).toBe(false);
        expect(getLatestCommittedTurnBoundary([])).toBeNull();
    });
});
