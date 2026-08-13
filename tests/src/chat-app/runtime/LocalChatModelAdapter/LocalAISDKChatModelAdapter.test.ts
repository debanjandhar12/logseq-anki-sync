import type {ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {LocalAISDKChatModelAdapter} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter";

const {streamTextMock} = vi.hoisted(() => ({streamTextMock: vi.fn()}));

vi.mock("ai", async (importOriginal) => {
    const original = await importOriginal<typeof import("ai")>();
    return {
        ...original,
        convertToModelMessages: vi.fn(async () => []),
        streamText: streamTextMock
    };
});

vi.mock("../../../../../src/core/ai-sdk/getLLMModel", () => ({
    getLLMModel: vi.fn(async () => ({}))
}));

vi.mock("../../../../../src/core/ai-sdk/getLLMProviderTools", () => ({
    getLLMProviderTools: vi.fn(() => ({}))
}));

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
}

function toolCall(toolCallId: string, toolName: string) {
    return {
        type: "tool-call" as const,
        toolCallId,
        toolName,
        input: {},
        providerExecuted: false
    };
}

function currentAssistantMessage(): ThreadMessage {
    return {
        id: "assistant-1",
        role: "assistant",
        content: [],
        status: {type: "running"},
        createdAt: new Date(),
        metadata: {custom: {}}
    } as unknown as ThreadMessage;
}

function runAdapter(tools: Record<string, Tool>) {
    const result = LocalAISDKChatModelAdapter.run({
        messages: [],
        abortSignal: new AbortController().signal,
        context: {config: {modelName: "test-model"}, tools},
        unstable_getMessage: currentAssistantMessage
    } as never);

    if (!(Symbol.asyncIterator in result)) throw new Error("Expected streaming adapter result");
    return result;
}

function getToolPart(result: ChatModelRunResult, toolCallId: string) {
    const part = result.content?.find(
        (contentPart) => contentPart.type === "tool-call" && contentPart.toolCallId === toolCallId
    );
    if (!part || part.type !== "tool-call") throw new Error(`Missing tool call ${toolCallId}`);
    return part;
}

async function nextValue(stream: AsyncGenerator<ChatModelRunResult>) {
    const next = await stream.next();
    if (next.done) throw new Error("Adapter stream ended unexpectedly");
    return next.value;
}

describe("LocalAISDKChatModelAdapter frontend tool lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-13T10:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("keeps automatic tools running and executes a model batch strictly in order", async () => {
        const first = deferred<unknown>();
        const second = deferred<unknown>();
        const firstExecute = vi.fn(() => first.promise);
        const secondExecute = vi.fn(() => second.promise);

        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("call-1", "first");
                yield toolCall("call-2", "second");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            first: {type: "frontend", execute: firstExecute} as Tool,
            second: {type: "frontend", execute: secondExecute} as Tool
        });

        expect((await nextValue(stream)).status).toEqual({type: "running"});
        expect((await nextValue(stream)).status).toEqual({type: "running"});

        const firstStarted = await nextValue(stream);
        expect(getToolPart(firstStarted, "call-1").timing).toEqual({
            startedAt: Date.now()
        });
        expect(firstExecute).not.toHaveBeenCalled();

        const firstCompletion = stream.next();
        await vi.waitFor(() => expect(firstExecute).toHaveBeenCalledOnce());
        expect(secondExecute).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        first.resolve({success: true, value: "first"});
        const firstCompletedResult = await firstCompletion;
        if (firstCompletedResult.done) throw new Error("Missing first tool completion");
        const firstCompleted = firstCompletedResult.value as ChatModelRunResult;
        expect(getToolPart(firstCompleted, "call-1")).toMatchObject({
            result: {success: true, value: "first"},
            timing: {
                startedAt: Date.parse("2026-08-13T10:00:00.000Z")
            }
        });
        expect(getToolPart(firstCompleted, "call-1").timing?.completedAt).toBeGreaterThan(
            getToolPart(firstCompleted, "call-1").timing?.startedAt ?? 0
        );
        expect(secondExecute).not.toHaveBeenCalled();

        const secondStarted = await nextValue(stream);
        expect(getToolPart(secondStarted, "call-2").timing?.startedAt).toBe(
            getToolPart(firstCompleted, "call-1").timing?.completedAt
        );
        expect(secondExecute).not.toHaveBeenCalled();

        const secondCompletion = stream.next();
        await vi.waitFor(() => expect(secondExecute).toHaveBeenCalledOnce());
        second.resolve({success: true, value: "second"});
        await secondCompletion;

        const finalYield = await nextValue(stream);
        expect(finalYield.status).toEqual({type: "requires-action", reason: "tool-calls"});
        expect(getToolPart(finalYield, "call-1").result).toEqual({
            success: true,
            value: "first"
        });
        expect(getToolPart(finalYield, "call-2").result).toEqual({
            success: true,
            value: "second"
        });
    });

    test("leaves human tools unresolved without execution timing", async () => {
        const humanExecute = vi.fn();
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("human-1", "confirm");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            confirm: {type: "human", execute: humanExecute} as Tool
        });
        const runningYield = await nextValue(stream);
        expect(runningYield.status).toEqual({type: "running"});
        expect(getToolPart(runningYield, "human-1").timing).toBeUndefined();

        const finalYield = await nextValue(stream);
        expect(finalYield.status).toEqual({type: "requires-action", reason: "tool-calls"});
        expect(getToolPart(finalYield, "human-1").result).toBeUndefined();
        expect(humanExecute).not.toHaveBeenCalled();
    });

    test("records a missing frontend executor as a completed tool error", async () => {
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("missing-1", "missing");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({missing: {type: "frontend"} as Tool});
        await nextValue(stream);
        await nextValue(stream);
        const completedYield = await nextValue(stream);
        const completedPart = getToolPart(completedYield, "missing-1");

        expect(completedPart).toMatchObject({
            result: {success: false, error: "Tool cannot be executed: missing"},
            isError: true
        });
        expect(completedPart.timing?.completedAt).toBeDefined();
        expect((await nextValue(stream)).status).toEqual({
            type: "requires-action",
            reason: "tool-calls"
        });
    });

    test("does not execute automatic calls after a human-action boundary", async () => {
        const automaticExecute = vi.fn();
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("human-1", "confirm");
                yield toolCall("automatic-1", "mutate");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            confirm: {type: "human"} as Tool,
            mutate: {type: "frontend", execute: automaticExecute} as Tool
        });
        await nextValue(stream);
        await nextValue(stream);
        const blockedYield = await nextValue(stream);

        expect(getToolPart(blockedYield, "automatic-1")).toMatchObject({
            result: {
                success: false,
                error: "Tool was not executed because an earlier tool requires user action."
            },
            isError: true
        });
        expect(automaticExecute).not.toHaveBeenCalled();

        const finalYield = await nextValue(stream);
        expect(finalYield.status).toEqual({type: "requires-action", reason: "tool-calls"});
        expect(getToolPart(finalYield, "human-1").result).toBeUndefined();
    });
});
