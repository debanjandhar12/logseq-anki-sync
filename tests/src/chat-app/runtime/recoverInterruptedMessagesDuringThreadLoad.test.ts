import type {ExportedMessageRepository, ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {recoverInterruptedMessagesDuringThreadLoad} from "../../../../src/chat-app/runtime/thread-run";

function assistantMessage(options: {
    id: string;
    status: "running" | "requires-action";
    toolName?: string;
    resolved?: boolean;
    textOnly?: boolean;
}): ThreadMessage {
    return {
        id: options.id,
        role: "assistant",
        createdAt: new Date(),
        status:
            options.status === "running"
                ? {type: "running"}
                : {type: "requires-action", reason: "tool-calls"},
        metadata: {custom: {}},
        content: options.textOnly
            ? [{type: "text", text: "partial"}]
            : [
                  {
                      type: "tool-call",
                      toolCallId: `tool-${options.id}`,
                      toolName: options.toolName ?? "automatic_tool",
                      args: {},
                      argsText: "{}",
                      ...(options.resolved ? {result: {success: true}} : {})
                  }
              ]
    } as unknown as ThreadMessage;
}

describe("recoverInterruptedMessagesDuringThreadLoad", () => {
    test("adds terminal results to unresolved tools on active and inactive branches", () => {
        const repository: ExportedMessageRepository = {
            headId: "active",
            messages: [
                {message: assistantMessage({id: "active", status: "running"}), parentId: null},
                {
                    message: assistantMessage({id: "inactive", status: "running"}),
                    parentId: null
                }
            ]
        };

        const recovered = recoverInterruptedMessagesDuringThreadLoad(repository, []);

        for (const item of recovered.messages) {
            expect(item.message.status).toEqual({type: "incomplete", reason: "cancelled"});
            expect(item.message.content[0]).toMatchObject({
                result: {
                    success: false,
                    error: expect.stringContaining("closed or reloaded")
                },
                isError: true
            });
        }
    });

    test("terminalizes text and settled automatic messages without unresolved tools", () => {
        const repository: ExportedMessageRepository = {
            headId: "settled",
            messages: [
                {
                    message: assistantMessage({id: "text", status: "running", textOnly: true}),
                    parentId: null
                },
                {
                    message: assistantMessage({
                        id: "settled",
                        status: "requires-action",
                        resolved: true
                    }),
                    parentId: "text"
                }
            ]
        };

        const recovered = recoverInterruptedMessagesDuringThreadLoad(repository, []);
        expect(recovered.messages.map(({message}) => message.status)).toEqual([
            {type: "incomplete", reason: "cancelled"},
            {type: "incomplete", reason: "cancelled"}
        ]);
    });

    test("leaves a pending human tool actionable", () => {
        const humanMessage = assistantMessage({
            id: "human",
            status: "requires-action",
            toolName: "human_tool"
        });
        const repository: ExportedMessageRepository = {
            headId: "human",
            messages: [{message: humanMessage, parentId: null}]
        };

        expect(recoverInterruptedMessagesDuringThreadLoad(repository, ["human_tool"])).toBe(
            repository
        );
    });

    test("recovers automatic siblings while preserving a pending human tool", () => {
        const humanMessage = assistantMessage({
            id: "mixed",
            status: "requires-action",
            toolName: "human_tool"
        });
        if (humanMessage.role !== "assistant") throw new Error("Expected assistant message");
        const mixedMessage = {
            ...humanMessage,
            content: [
                ...humanMessage.content,
                {
                    type: "tool-call",
                    toolCallId: "automatic-tool",
                    toolName: "automatic_tool",
                    args: {},
                    argsText: "{}"
                }
            ]
        } as ThreadMessage;
        const repository: ExportedMessageRepository = {
            headId: "mixed",
            messages: [{message: mixedMessage, parentId: null}]
        };

        const recovered = recoverInterruptedMessagesDuringThreadLoad(repository, ["human_tool"]);
        const message = recovered.messages[0]?.message;
        expect(message?.status).toEqual({type: "requires-action", reason: "tool-calls"});
        expect(message?.content[0]).not.toHaveProperty("result");
        expect(message?.content[1]).toMatchObject({
            result: {
                success: false,
                error: expect.stringContaining("closed or reloaded")
            },
            isError: true
        });
    });

    test("recovers automatic siblings while preserving a pending approval", () => {
        const approvalMessage = assistantMessage({
            id: "approval-mixed",
            status: "requires-action",
            toolName: "approval_tool"
        });
        if (approvalMessage.role !== "assistant") throw new Error("Expected assistant message");
        const approvalPart = approvalMessage.content[0];
        if (!approvalPart || approvalPart.type !== "tool-call") {
            throw new Error("Expected tool call");
        }
        const mixedMessage = {
            ...approvalMessage,
            content: [
                {...approvalPart, approval: {id: "approval-1"}},
                {
                    type: "tool-call",
                    toolCallId: "automatic-tool",
                    toolName: "automatic_tool",
                    args: {},
                    argsText: "{}"
                }
            ]
        } as ThreadMessage;
        const repository: ExportedMessageRepository = {
            headId: "approval-mixed",
            messages: [{message: mixedMessage, parentId: null}]
        };

        const recovered = recoverInterruptedMessagesDuringThreadLoad(repository, []);
        const message = recovered.messages[0]?.message;
        expect(message?.status).toEqual({type: "requires-action", reason: "tool-calls"});
        expect(message?.content[0]).not.toHaveProperty("result");
        expect(message?.content[1]).toMatchObject({result: {success: false}, isError: true});
    });
});
