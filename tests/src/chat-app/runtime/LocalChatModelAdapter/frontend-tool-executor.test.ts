import type {ThreadMessage} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import {describe, expect, test, vi} from "vitest";
import {executeFrontendToolPlan} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/frontend-tool-executor";
import type {FrontendToolPlanItem} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/frontend-tool-planner";
import {createToolCallMessagePart} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-call-message-part";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
}

const call = (id: string) =>
    createToolCallMessagePart({type: "tool-call", toolCallId: id, toolName: id, input: {}});

describe("executeFrontendToolPlan", () => {
    test("does not start the next call until the previous finished event is consumed", async () => {
        const first = deferred<unknown>();
        const firstExecute = vi.fn(() => first.promise);
        const secondExecute = vi.fn(async () => ({success: true}));
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
        let now = 10;
        const events = executeFrontendToolPlan(plan, {
            abortSignal: new AbortController().signal,
            getMessages: () => [] as ThreadMessage[],
            now: () => now
        });

        expect((await events.next()).value).toEqual({
            type: "started",
            toolCallId: "first",
            startedAt: 10
        });
        expect(firstExecute).not.toHaveBeenCalled();
        const firstFinished = events.next();
        await vi.waitFor(() => expect(firstExecute).toHaveBeenCalledOnce());
        expect(secondExecute).not.toHaveBeenCalled();
        now = 20;
        first.resolve({success: true});
        expect((await firstFinished).value).toMatchObject({
            type: "finished",
            toolCallId: "first",
            completedAt: 20
        });
        expect(secondExecute).not.toHaveBeenCalled();

        expect((await events.next()).value).toEqual({
            type: "started",
            toolCallId: "second",
            startedAt: 20
        });
        expect(secondExecute).not.toHaveBeenCalled();
    });

    test("emits terminal errors without invoking or timing them", async () => {
        const plan: FrontendToolPlanItem[] = [
            {
                kind: "final-error",
                reason: "unknown-tool",
                toolCall: call("unknown"),
                message: "Unknown tool: unknown"
            }
        ];
        const events = executeFrontendToolPlan(plan, {
            abortSignal: new AbortController().signal,
            getMessages: () => []
        });

        expect((await events.next()).value).toMatchObject({
            type: "finished",
            toolCallId: "unknown",
            patch: {result: {success: false, error: "Unknown tool: unknown"}, isError: true}
        });
    });

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
});
