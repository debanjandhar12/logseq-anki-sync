import {LocalRuntimeCore} from "@assistant-ui/core/internal";
import type {Tool} from "assistant-stream";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {LocalAISDKChatModelAdapter} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter";

const {convertToModelMessagesMock, streamTextMock} = vi.hoisted(() => ({
    convertToModelMessagesMock: vi.fn(async (..._args: unknown[]) => []),
    streamTextMock: vi.fn()
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
    getLLMModel: vi.fn(async () => ({}))
}));

vi.mock("../../../../../src/core/ai-sdk/getLLMProviderTools", () => ({
    getLLMProviderTools: vi.fn(() => ({}))
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
            getModelContext: () => ({config: {modelName: "test-model"}, tools: {automatic: tool}})
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

});
