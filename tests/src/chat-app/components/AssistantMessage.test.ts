import {describe, expect, test} from "vitest";
import {groupMessagePart} from "../../../../src/chat-app/components/AssistantMessage";

function toolPart(
    status: "running" | "requires-action" | "complete"
): Parameters<typeof groupMessagePart>[0] {
    return {
        type: "tool-call" as const,
        toolCallId: "call-1",
        toolName: "test_tool",
        args: {},
        argsText: "{}",
        status:
            status === "requires-action"
                ? ({type: status, reason: "interrupt"} as const)
                : ({type: status} as const)
    } as Parameters<typeof groupMessagePart>[0];
}

describe("groupMessagePart", () => {
    test("groups running tools with chain-of-thought content", () => {
        expect(groupMessagePart(toolPart("running"))).toEqual(["group-chainOfThought"]);
    });

    test("keeps tools with standalone toolkit metadata outside the group", () => {
        expect(
            groupMessagePart(toolPart("requires-action"), {
                toolUIs: {test_tool: [{standalone: true}]}
            } as never)
        ).toEqual([]);
    });
});
