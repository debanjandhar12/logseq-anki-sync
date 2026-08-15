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
});
