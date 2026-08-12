import {describe, expect, test} from "vitest";
import {ChatDebugReportFormatter} from "../../../../src/chat-app/export/ChatDebugReportFormatter";

describe("ChatDebugReportFormatter", () => {
    test("preserves the raw stored JSON and removes all tool-call artifacts", () => {
        const rawThreadJson =
            '{"remoteId":"thread-1","exportedMessageRepository":{"messages":[{"message":{"content":[{"type":"tool-call","artifact":{"private":true},"messages":[{"content":[{"type":"tool-call","artifact":{"nested":true},"result":1}]}]},{"type":"data","artifact":{"keep":true}}]}}]}}';

        expect(ChatDebugReportFormatter.format(rawThreadJson)).toBe(
            [
                "Chat Data without logseq reversible artifacts:",
                "```",
                '{"remoteId":"thread-1","exportedMessageRepository":{"messages":[{"message":{"content":[{"type":"tool-call","messages":[{"content":[{"type":"tool-call","result":1}]}]},{"type":"data","artifact":{"keep":true}}]}}]}}',
                "```",
                "",
                "Full Chat Data JSON:",
                "```",
                rawThreadJson,
                "```"
            ].join("\n")
        );
    });

    test("formats nested artifacts without changing the raw full section", () => {
        const rawThreadJson =
            '{"type":"tool-call","artifact":{"private":true},"result":[{"type":"tool-call","artifact":{"nested":true}}]}';
        const formatted = ChatDebugReportFormatter.format(rawThreadJson);

        expect(formatted).toContain('{"type":"tool-call","result":[{"type":"tool-call"}]}');
        expect(formatted).toContain(rawThreadJson);
    });

    test("rejects malformed stored JSON", () => {
        expect(() => ChatDebugReportFormatter.format("not json")).toThrow();
    });
});
