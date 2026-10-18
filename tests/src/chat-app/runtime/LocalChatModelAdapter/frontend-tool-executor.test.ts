// @vitest-environment node
import type {Tool} from "assistant-stream";
import {describe, expect, test, vi} from "vitest";
import {executeFrontendToolPlan} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/frontend-tool-executor";
import type {FrontendToolPlanItem} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/frontend-tool-planner";
import {createToolCallMessagePart} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-call-message-part";

const call = (id: string) =>
    createToolCallMessagePart({type: "tool-call", toolCallId: id, toolName: id, input: {}});

vi.mock("../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-result-limiter", () => ({
    storeAndTruncateOversizedToolResult: vi.fn(async () => undefined)
}));

describe("executeFrontendToolPlan", () => {
    test("cancels promptly and never starts a later call", async () => {
        const controller = new AbortController();
        const firstExecute = vi.fn(() => new Promise(() => {}));
        const secondExecute = vi.fn();
        const plan: FrontendToolPlanItem[] = [
            {
                kind: "execute",
                toolCall: call("first"),
                tool: {type: "frontend", execute: firstExecute} as Tool
            },
            {
                kind: "execute",
                toolCall: call("second"),
                tool: {type: "frontend", execute: secondExecute} as Tool
            }
        ];
        const events = executeFrontendToolPlan(plan, {
            abortSignal: controller.signal,
            getMessages: () => []
        });

        await events.next();
        const cancelled = events.next();
        await vi.waitFor(() => expect(firstExecute).toHaveBeenCalledOnce());
        controller.abort();
        expect((await cancelled).value).toMatchObject({type: "cancelled", toolCallId: "first"});
        expect(secondExecute).not.toHaveBeenCalled();
        expect((await events.next()).done).toBe(true);
    });

    test("cancels promptly while model output normalization is pending", async () => {
        const controller = new AbortController();
        const toModelOutput = vi.fn(() => new Promise(() => {}));
        const plan: FrontendToolPlanItem[] = [
            {
                kind: "execute",
                toolCall: call("first"),
                tool: {
                    type: "frontend",
                    execute: vi.fn(async () => ({success: true})),
                    toModelOutput
                } as Tool
            }
        ];
        const events = executeFrontendToolPlan(plan, {
            abortSignal: controller.signal,
            getMessages: () => []
        });

        await events.next();
        const cancelled = events.next();
        await vi.waitFor(() => expect(toModelOutput).toHaveBeenCalledOnce());
        controller.abort();

        expect((await cancelled).value).toMatchObject({type: "cancelled", toolCallId: "first"});
        expect((await events.next()).done).toBe(true);
    });
});
