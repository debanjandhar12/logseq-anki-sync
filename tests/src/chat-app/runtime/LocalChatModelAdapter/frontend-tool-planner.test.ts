import type {Tool} from "assistant-stream";
import {describe, expect, test, vi} from "vitest";
import {planFrontendToolCalls} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/frontend-tool-planner";
import {createToolCallMessagePart} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-call-message-part";

const call = (toolCallId: string, toolName: string) =>
    createToolCallMessagePart({type: "tool-call", toolCallId, toolName, input: {}});

describe("planFrontendToolCalls", () => {
    test("preserves executable call order", () => {
        const executeA = vi.fn();
        const executeB = vi.fn();
        const plan = planFrontendToolCalls([call("1", "a"), call("2", "b")], {
            a: {type: "frontend", execute: executeA} as Tool,
            b: {type: "frontend", execute: executeB} as Tool
        });

        expect(plan.map((item) => [item.kind, item.toolCall.toolCallId])).toEqual([
            ["execute", "1"],
            ["execute", "2"]
        ]);
    });

    test("awaits a human call and blocks every later automatic call", () => {
        const plan = planFrontendToolCalls(
            [call("1", "before"), call("2", "human"), call("3", "after"), call("4", "last")],
            {
                before: {type: "frontend", execute: vi.fn()} as Tool,
                human: {type: "human"} as Tool,
                after: {type: "frontend", execute: vi.fn()} as Tool,
                last: {type: "frontend", execute: vi.fn()} as Tool
            }
        );

        expect(plan.map((item) => item.kind)).toEqual([
            "execute",
            "await-human",
            "final-error",
            "final-error"
        ]);
        expect(plan[2]).toMatchObject({reason: "blocked-by-human"});
        expect(plan[3]).toMatchObject({reason: "blocked-by-human"});
    });

    test("settles unknown and missing tools without creating a human boundary", () => {
        const plan = planFrontendToolCalls(
            [call("1", "unknown"), call("2", "missing"), call("3", "valid")],
            {
                missing: {type: "frontend"} as Tool,
                valid: {type: "frontend", execute: vi.fn()} as Tool
            }
        );

        expect(plan).toMatchObject([
            {kind: "final-error", reason: "unknown-tool"},
            {kind: "final-error", reason: "missing-executor"},
            {kind: "execute"}
        ]);
    });
});
