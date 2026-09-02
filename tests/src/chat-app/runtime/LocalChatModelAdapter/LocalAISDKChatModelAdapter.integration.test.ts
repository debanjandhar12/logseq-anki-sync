import {LocalRuntimeCore} from "@assistant-ui/core/internal";
import type {Tool} from "assistant-stream";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {LocalAISDKChatModelAdapter} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter";

const {convertToModelMessagesMock, streamTextMock, resolveLLMSelectionMock} = vi.hoisted(() => ({
    convertToModelMessagesMock: vi.fn(async (..._args: unknown[]) => []),
    streamTextMock: vi.fn(),
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
        convertToModelMessages: convertToModelMessagesMock,
        streamText: streamTextMock
    };
});

vi.mock("../../../../../src/core/ai-sdk/getLLMModel", () => ({
    createLLMModel: vi.fn(() => ({}))
}));

vi.mock("../../../../../src/core/ai-sdk/getLLMProviderTools", () => ({
    getLLMProviderTools: vi.fn(() => ({}))
}));

vi.mock("../../../../../src/core/ai-sdk/provider-config/readProviderConfigs", () => ({
    readProviderConfigs: vi.fn(() => [])
}));

vi.mock("../../../../../src/core/ai-sdk/provider-config/resolveLLMSelection", () => ({
    resolveLLMSelection: resolveLLMSelectionMock
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("LocalAISDKChatModelAdapter with LocalRuntime", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("continues exactly once after an automatic result and preserves it in the assistant message", async () => {
        const execute = vi.fn(async () => ({success: true, value: "result"}));
        let modelStep = 0;
        streamTextMock.mockImplementation(() => ({
            stream: (async function* () {
                modelStep += 1;
                if (modelStep === 1) {
                    yield {
                        type: "tool-call",
                        toolCallId: "call-1",
                        toolName: "automatic",
                        input: {},
                        providerExecuted: false
                    };
                    yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
                    return;
                }
                yield {type: "text-delta", text: "done"};
                yield {type: "finish", finishReason: "stop", totalUsage: {}};
            })()
        }));

        const core = new LocalRuntimeCore(
            {adapters: {chatModel: LocalAISDKChatModelAdapter}, maxSteps: 3},
            undefined
        );
        const tool: Tool = {type: "frontend", execute} as Tool;
        core.registerModelContextProvider({
            getModelContext: () => ({
                config: {modelName: "selected////test-model"},
                tools: {automatic: tool}
            })
        });
        const thread = core.threads.getMainThreadRuntimeCore();

        await thread.append({
            parentId: null,
            sourceId: null,
            runConfig: {},
            role: "user",
            content: [{type: "text", text: "run the tool"}],
            attachments: [],
            metadata: {custom: {}},
            createdAt: new Date()
        });
        await flush();

        expect(streamTextMock).toHaveBeenCalledTimes(2);
        expect(convertToModelMessagesMock).toHaveBeenCalledTimes(2);
        const secondRoundtripMessages = convertToModelMessagesMock.mock.calls[1]?.[0] as
            | Array<{role: string; parts: unknown[]}>
            | undefined;
        if (!secondRoundtripMessages) throw new Error("Missing second model roundtrip");
        expect(secondRoundtripMessages).toHaveLength(2);
        expect(secondRoundtripMessages?.[1]).toMatchObject({
            role: "assistant",
            parts: [
                expect.objectContaining({
                    type: "tool-automatic",
                    toolCallId: "call-1",
                    state: "output-available",
                    output: {success: true, value: "result"}
                })
            ]
        });
        expect(execute).toHaveBeenCalledOnce();
        const assistant = thread.messages.at(-1);
        expect(assistant?.status.type).toBe("complete");
        expect(assistant?.content.map((part) => part.type)).toEqual(["tool-call", "text"]);
        expect(assistant?.content[0]).toMatchObject({
            type: "tool-call",
            toolCallId: "call-1",
            result: {success: true, value: "result"}
        });
    });

    test("preserves distinct parallel tool calls through execution and continuation", async () => {
        const firstExecute = vi.fn(async () => ({success: true, value: "first-result"}));
        const secondExecute = vi.fn(async () => ({success: true, value: "second-result"}));
        let modelStep = 0;
        streamTextMock.mockImplementation(() => ({
            stream: (async function* () {
                modelStep += 1;
                if (modelStep === 1) {
                    yield {
                        type: "tool-call",
                        toolCallId: "call-1",
                        toolName: "first",
                        input: {value: 1},
                        providerExecuted: false
                    };
                    yield {
                        type: "tool-call",
                        toolCallId: "call-2",
                        toolName: "second",
                        input: {value: 2},
                        providerExecuted: false
                    };
                    yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
                    return;
                }
                yield {type: "text-delta", text: "done"};
                yield {type: "finish", finishReason: "stop", totalUsage: {}};
            })()
        }));

        const core = new LocalRuntimeCore(
            {adapters: {chatModel: LocalAISDKChatModelAdapter}, maxSteps: 3},
            undefined
        );
        core.registerModelContextProvider({
            getModelContext: () => ({
                config: {modelName: "selected////test-model"},
                tools: {
                    first: {type: "frontend", execute: firstExecute} as Tool,
                    second: {type: "frontend", execute: secondExecute} as Tool
                }
            })
        });
        const thread = core.threads.getMainThreadRuntimeCore();

        await thread.append({
            parentId: null,
            sourceId: null,
            runConfig: {},
            role: "user",
            content: [{type: "text", text: "run both tools"}],
            attachments: [],
            metadata: {custom: {}},
            createdAt: new Date()
        });
        await vi.waitFor(() => {
            expect(streamTextMock).toHaveBeenCalledTimes(2);
            expect(firstExecute).toHaveBeenCalledOnce();
            expect(secondExecute).toHaveBeenCalledOnce();
            expect(thread.messages.at(-1)?.status.type).toBe("complete");
        });

        expect(firstExecute).toHaveBeenCalledWith(
            {value: 1},
            expect.objectContaining({toolCallId: "call-1"})
        );
        expect(secondExecute).toHaveBeenCalledWith(
            {value: 2},
            expect.objectContaining({toolCallId: "call-2"})
        );
        expect(convertToModelMessagesMock).toHaveBeenCalledTimes(2);

        const secondRoundtripMessages = convertToModelMessagesMock.mock.calls[1]?.[0] as
            | Array<{role: string; parts: unknown[]}>
            | undefined;
        expect(secondRoundtripMessages?.[1]).toMatchObject({
            role: "assistant",
            parts: [
                expect.objectContaining({
                    type: "tool-first",
                    toolCallId: "call-1",
                    input: {value: 1},
                    state: "output-available",
                    output: {success: true, value: "first-result"}
                }),
                expect.objectContaining({
                    type: "tool-second",
                    toolCallId: "call-2",
                    input: {value: 2},
                    state: "output-available",
                    output: {success: true, value: "second-result"}
                })
            ]
        });

        const assistant = thread.messages.at(-1);
        expect(thread.messages).toHaveLength(2);
        expect(thread.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
        expect(assistant?.status.type).toBe("complete");
        expect(assistant?.content).toEqual([
            expect.objectContaining({
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "first",
                args: {value: 1},
                result: {success: true, value: "first-result"}
            }),
            expect.objectContaining({
                type: "tool-call",
                toolCallId: "call-2",
                toolName: "second",
                args: {value: 2},
                result: {success: true, value: "second-result"}
            }),
            expect.objectContaining({type: "text", text: "done"})
        ]);
    });
});
