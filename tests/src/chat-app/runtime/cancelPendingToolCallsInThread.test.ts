import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {cancelPendingToolCallsInRepository} from "../../../../src/chat-app/runtime/cancelPendingToolCallsInThread";

const createAssistantMessage = (options: {
    id: string;
    status: "complete" | "requires-action";
    hasResult?: boolean;
    hasApproval?: boolean;
}): ThreadMessage =>
    ({
        id: options.id,
        role: "assistant",
        createdAt: new Date(),
        status:
            options.status === "requires-action"
                ? {type: "requires-action", reason: "tool-calls"}
                : {type: "complete", reason: "stop"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId: `tool-${options.id}`,
                toolName: "human_tool",
                args: {},
                argsText: "{}",
                ...(options.hasResult ? {result: {success: true}} : {}),
                ...(options.hasApproval ? {approval: {id: `approval-${options.id}`}} : {})
            }
        ]
    }) as unknown as ThreadMessage;

describe("cancelPendingToolCallsInRepository", () => {
    test("cancels unresolved tool calls without changing completed messages", () => {
        const complete = createAssistantMessage({id: "complete", status: "complete"});
        const pending = createAssistantMessage({
            id: "pending",
            status: "requires-action",
            hasApproval: true
        });
        const repository: ExportedMessageRepository = {
            headId: "pending",
            messages: [
                {message: complete, parentId: null},
                {message: pending, parentId: "complete"}
            ]
        };

        const patched = cancelPendingToolCallsInRepository(repository);

        expect(patched.messages[0]).toBe(repository.messages[0]);
        expect(patched.messages[1]?.message.status).toEqual({
            type: "incomplete",
            reason: "cancelled"
        });
        const part = patched.messages[1]?.message.content[0];
        expect(part).toMatchObject({
            type: "tool-call",
            result: {success: false, error: "User canceled operation"},
            isError: true,
            approval: {
                resolution: "cancelled",
                reason: "User canceled operation"
            }
        });
    });

    test("preserves tool calls that already have results", () => {
        const message = createAssistantMessage({
            id: "resolved",
            status: "requires-action",
            hasResult: true
        });
        const repository: ExportedMessageRepository = {
            headId: "resolved",
            messages: [{message, parentId: null}]
        };

        const patched = cancelPendingToolCallsInRepository(repository);

        expect(patched.messages[0]).toBe(repository.messages[0]);
    });
});
