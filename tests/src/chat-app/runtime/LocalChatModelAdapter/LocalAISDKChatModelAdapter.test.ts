import type {ChatModelRunResult, ThreadMessage} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {LocalAISDKChatModelAdapter} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter";
import {WebSearchTool} from "../../../../../src/chat-app/tools/impl/WebSearchTool";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";

const {
    streamTextMock,
    createLLMModelMock,
    getLLMProviderToolsMock,
    resolveLLMSelectionMock,
    getPluginSettingsMock
} = vi.hoisted(() => ({
    streamTextMock: vi.fn(),
    createLLMModelMock: vi.fn(() => ({})),
    getLLMProviderToolsMock: vi.fn(() => ({})),
    getPluginSettingsMock: vi.fn(() => ({jinaApiKey: undefined as string | undefined})),
    resolveLLMSelectionMock: vi.fn(() => ({
        config: {
            uuid: "10000000-0000-4000-8000-000000000001",
            name: "Selected",
            type: "openai",
            baseUrl: "https://provider.test/v1",
            apiKey: "secret",
            models: [{id: "test-model", enabled: true}]
        },
        rawModelId: "test-model"
    }))
}));

vi.mock("ai", async (importOriginal) => {
    const original = await importOriginal<typeof import("ai")>();
    return {
        ...original,
        convertToModelMessages: vi.fn(async () => []),
        streamText: streamTextMock
    };
});

vi.mock("../../../../../src/core/ai-sdk/getLLMModel", () => ({
    createLLMModel: createLLMModelMock
}));

vi.mock("../../../../../src/core/ai-sdk/getLLMProviderTools", () => ({
    getLLMProviderTools: getLLMProviderToolsMock
}));

vi.mock("../../../../../src/core/ai-sdk/provider-config/readProviderConfigs", () => ({
    readProviderConfigs: vi.fn(() => [])
}));

vi.mock("../../../../../src/core/ai-sdk/provider-config/resolveLLMSelection", () => ({
    resolveLLMSelection: resolveLLMSelectionMock
}));

vi.mock("../../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: {getPluginSettings: getPluginSettingsMock}
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

function providerToolCall(toolCallId: string, toolName: string) {
    return {...toolCall(toolCallId, toolName), providerExecuted: true};
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

function runAdapter(tools: Record<string, Tool>, abortSignal = new AbortController().signal) {
    const result = LocalAISDKChatModelAdapter.run({
        messages: [],
        abortSignal,
        context: {config: {modelName: "selected////test-model"}, tools},
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
        expect(resolveLLMSelectionMock).toHaveBeenCalledOnce();
        const resolvedSelection = resolveLLMSelectionMock.mock.results[0]?.value;
        expect(createLLMModelMock).toHaveBeenCalledWith(resolvedSelection);
        expect(getLLMProviderToolsMock).toHaveBeenCalledWith(resolvedSelection);

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
        const completedYield = await nextValue(stream);
        const completedPart = getToolPart(completedYield, "missing-1");

        expect(completedPart).toMatchObject({
            result: {success: false, error: "Tool cannot be executed: missing"},
            isError: true
        });
        expect(completedPart.timing).toBeUndefined();
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

    test("settles unknown tools as errors instead of leaving unresolved calls", async () => {
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("unknown-1", "unknown");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({});
        await nextValue(stream);
        const errorYield = await nextValue(stream);
        expect(getToolPart(errorYield, "unknown-1")).toMatchObject({
            result: {success: false, error: "Unknown tool: unknown"},
            isError: true
        });
        expect((await nextValue(stream)).status).toEqual({
            type: "requires-action",
            reason: "tool-calls"
        });
    });

    test("ends as cancelled without continuation when execution is aborted", async () => {
        const controller = new AbortController();
        const execute = vi.fn(() => new Promise(() => {}));
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("slow-1", "slow");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({slow: {type: "frontend", execute} as Tool}, controller.signal);
        await nextValue(stream);
        await nextValue(stream);
        const cancelledYield = stream.next();
        await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
        controller.abort();

        const cancelledResult = await cancelledYield;
        if (cancelledResult.done) throw new Error("Missing cancellation result");
        expect((cancelledResult.value as ChatModelRunResult).status).toEqual({
            type: "incomplete",
            reason: "cancelled"
        });
        expect((await stream.next()).done).toBe(true);
    });

    test("keeps provider-executed calls outside frontend execution and continuation", async () => {
        const frontendExecute = vi.fn();
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield providerToolCall("provider-1", "web_search");
                yield {
                    type: "tool-result",
                    toolCallId: "provider-1",
                    output: undefined,
                    providerExecuted: true
                };
                yield {type: "finish", finishReason: "stop", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            web_search: {type: "frontend", execute: frontendExecute} as Tool
        });
        await nextValue(stream);
        const resultYield = await nextValue(stream);
        expect(getToolPart(resultYield, "provider-1")).toMatchObject({
            providerExecuted: true,
            result: null,
            isError: false
        });
        expect((await nextValue(stream)).status).toEqual({type: "complete", reason: "stop"});
        expect(frontendExecute).not.toHaveBeenCalled();
    });

    test("does not advertise Jina tools to a native provider", async () => {
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield {type: "finish", finishReason: "stop", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            web_search: {type: "frontend", execute: vi.fn()} as Tool,
            web_page_get: {type: "frontend", execute: vi.fn()} as Tool
        });
        await nextValue(stream);

        expect(streamTextMock.mock.calls[0][0].tools).toEqual({});
    });

    test("advertises and executes Jina tools for a non-native provider with a key", async () => {
        const execute = vi.fn().mockResolvedValue({success: true});
        getPluginSettingsMock.mockReturnValue({jinaApiKey: "key"});
        resolveLLMSelectionMock.mockReturnValueOnce({
            config: {
                uuid: "10000000-0000-4000-8000-000000000001",
                name: "Selected",
                type: ProviderTypeEnum.OPENAI_COMPATIBLE,
                baseUrl: "https://provider.test/v1",
                apiKey: "secret",
                models: [{id: "test-model", enabled: true}]
            },
            rawModelId: "test-model"
        });
        streamTextMock.mockReturnValue({
            stream: (async function* () {
                yield toolCall("search-1", "web_search");
                yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
            })()
        });

        const stream = runAdapter({
            web_search: {...new WebSearchTool().getDefinition(), execute} as Tool
        });
        await nextValue(stream);
        await nextValue(stream);
        await nextValue(stream);
        const result = await nextValue(stream);

        expect(streamTextMock.mock.calls[0][0].tools.web_search).toBeDefined();
        expect(execute).toHaveBeenCalledOnce();
        expect(result.status).toEqual({type: "requires-action", reason: "tool-calls"});
    });
});
