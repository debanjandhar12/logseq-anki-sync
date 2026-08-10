import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {terminateToolTurn} from "../../../../src/chat-app/runtime/terminateToolTurn";

function assistantMessage(options: {
    id: string;
    status: "requires-action" | "incomplete";
    resolved?: boolean;
    approval?: boolean;
    artifact?: unknown;
}): ThreadMessage {
    return {
        id: options.id,
        role: "assistant",
        createdAt: new Date(),
        status:
            options.status === "requires-action"
                ? {type: "requires-action", reason: "tool-calls"}
                : {type: "incomplete", reason: "cancelled"},
        metadata: {custom: {}},
        content: [
            {
                type: "tool-call",
                toolCallId: `tool-${options.id}`,
                toolName: "test_tool",
                args: {},
                argsText: "{}",
                artifact: options.artifact,
                ...(options.resolved ? {result: {success: true}} : {}),
                ...(options.approval ? {approval: {id: `approval-${options.id}`}} : {})
            }
        ]
    } as unknown as ThreadMessage;
}

describe("terminateToolTurn", () => {
    test("terminates every unresolved call and preserves artifacts and resolved siblings", () => {
        const artifact = {tracker: {commands: ["one"]}};
        const pending = assistantMessage({
            id: "pending",
            status: "requires-action",
            approval: true,
            artifact
        });
        if (pending.role !== "assistant") throw new Error("Expected assistant message");
        const resolvedSibling = {
            type: "tool-call" as const,
            toolCallId: "resolved-sibling",
            toolName: "resolved_tool",
            args: {},
            argsText: "{}",
            result: {success: true}
        };
        const unresolvedSibling = {
            type: "tool-call" as const,
            toolCallId: "pending-sibling",
            toolName: "pending_tool",
            args: {},
            argsText: "{}"
        };
        const message = {
            ...pending,
            content: [...pending.content, resolvedSibling, unresolvedSibling]
        } as ThreadMessage;
        const repository: ExportedMessageRepository = {
            headId: "pending",
            messages: [{message, parentId: null}]
        };

        const result = terminateToolTurn(repository, {
            target: {messageId: "pending", toolCallId: "tool-pending", toolName: "test_tool"},
            errorMessage: "User terminated the operation"
        });

        expect(result.didChange).toBe(true);
        expect(result.repository.messages[0]?.message.status).toEqual({
            type: "incomplete",
            reason: "cancelled"
        });
        const content = result.repository.messages[0]?.message.content;
        expect(content).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    toolCallId: "tool-pending",
                    artifact,
                    result: {success: false, error: "User terminated the operation"},
                    approval: expect.objectContaining({
                        resolution: "cancelled",
                        reason: "User terminated the operation"
                    })
                }),
                resolvedSibling,
                expect.objectContaining({
                    toolCallId: "pending-sibling",
                    result: {success: false, error: "User terminated the operation"}
                })
            ])
        );
    });

    test("patches unresolved tools after active cancellation has made the message incomplete", () => {
        const message = assistantMessage({id: "running", status: "incomplete"});
        const repository: ExportedMessageRepository = {
            headId: "running",
            messages: [{message, parentId: null}]
        };

        const result = terminateToolTurn(repository, {
            target: {messageId: "running"},
            errorMessage: "User terminated the operation"
        });

        expect(result.didChange).toBe(true);
        expect(result.repository.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"},
            isError: true
        });
    });

    test("does not overwrite an already-approved decision with cancelled approval metadata", () => {
        const message = assistantMessage({
            id: "approved",
            status: "requires-action",
            approval: true
        });
        if (message.role !== "assistant") throw new Error("Expected assistant message");
        const part = message.content[0];
        if (!part || part.type !== "tool-call" || !part.approval) {
            throw new Error("Expected approval tool call");
        }
        const approvedMessage = {
            ...message,
            content: [{...part, approval: {...part.approval, approved: true}}]
        } as ThreadMessage;
        const repository: ExportedMessageRepository = {
            headId: "approved",
            messages: [{message: approvedMessage, parentId: null}]
        };

        const result = terminateToolTurn(repository, {
            target: {messageId: "approved"},
            errorMessage: "User terminated the operation"
        });

        expect(result.repository.messages[0]?.message.content[0]).toMatchObject({
            result: {success: false, error: "User terminated the operation"},
            approval: {approved: true}
        });
        expect(result.repository.messages[0]?.message.content[0]).not.toHaveProperty(
            "approval.resolution"
        );
    });

    test("does not fall back for stale exact targets or inactive branches", () => {
        const active = assistantMessage({id: "active", status: "requires-action"});
        const inactive = assistantMessage({id: "inactive", status: "requires-action"});
        const repository: ExportedMessageRepository = {
            headId: "active",
            messages: [
                {message: active, parentId: null},
                {message: inactive, parentId: null}
            ]
        };

        expect(
            terminateToolTurn(repository, {
                target: {messageId: "active", toolCallId: "stale"},
                errorMessage: "cancelled"
            })
        ).toEqual({repository, didChange: false});
        expect(
            terminateToolTurn(repository, {
                target: {messageId: "inactive"},
                errorMessage: "cancelled"
            })
        ).toEqual({repository, didChange: false});
    });

    test("does nothing when every tool call already has a result", () => {
        const message = assistantMessage({
            id: "resolved",
            status: "requires-action",
            resolved: true
        });
        const repository: ExportedMessageRepository = {
            headId: "resolved",
            messages: [{message, parentId: null}]
        };

        expect(
            terminateToolTurn(repository, {
                target: {messageId: "resolved"},
                errorMessage: "cancelled"
            })
        ).toEqual({repository, didChange: false});
    });
});
