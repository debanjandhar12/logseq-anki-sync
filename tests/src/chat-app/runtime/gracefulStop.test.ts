// @vitest-environment node
import {AssistantRuntimeImpl, LocalRuntimeCore} from "@assistant-ui/core/internal";
import type {ExportedMessageRepository, ThreadHistoryAdapter} from "@assistant-ui/react";
import {type ToolModelContentPart, ToolResponse} from "assistant-stream";
import {afterEach, expect, test, vi} from "vitest";
import {LocalAISDKChatModelAdapter} from "../../../../src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter";
import {stopThreadRun} from "../../../../src/chat-app/runtime/thread-run";
import {withRoundtripPersistence} from "../../../../src/chat-app/runtime/withRoundtripPersistence";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";

const {streamText} = vi.hoisted(() => ({streamText: vi.fn()}));
vi.mock("ai", async (importOriginal) => ({
    ...(await importOriginal<typeof import("ai")>()),
    convertToModelMessages: vi.fn(async () => []),
    streamText
}));
vi.mock("../../../../src/core/ai-sdk/getLLMModel", () => ({createLLMModel: vi.fn(() => ({}))}));
vi.mock("../../../../src/core/ai-sdk/getLLMProviderTools", () => ({
    getLLMProviderTools: () => ({})
}));
vi.mock("../../../../src/core/ai-sdk/provider-config/readProviderConfigs", () => ({
    readProviderConfigs: () => []
}));
vi.mock("../../../../src/core/ai-sdk/provider-config/resolveLLMSelection", () => ({
    resolveLLMSelection: () => ({config: {type: "openai"}, rawModelId: "test"})
}));
vi.mock("../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: {getPluginSettings: () => ({})}
}));
vi.mock("../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-result-limiter", () => ({
    storeAndTruncateOversizedToolResult: vi.fn(async () => undefined)
}));
vi.mock("../../../../src/core/stores/thread-store/ThreadStore", () => ({
    ThreadStore: {updateThread: vi.fn()}
}));
vi.mock("../../../../src/logger", () => ({
    createLogger: () => ({error: vi.fn()}),
    LoggerCategory: {CHAT_UI: "chat-ui"}
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return {promise, resolve, reject};
}

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

test.each([
    "success",
    "failure",
    "normalization",
    "last-tool"
] as const)("LocalRuntime accepts and persists the active tool's %s before stopping", async (mode) => {
    const execution = deferred<unknown>();
    const normalization = deferred<readonly ToolModelContentPart[]>();
    let toolSignal: AbortSignal | undefined;
    const execute = vi.fn((_args, context) => {
        toolSignal = context.abortSignal;
        return execution.promise;
    });
    const laterExecute = vi.fn();
    const toModelOutput = vi.fn(() => normalization.promise);
    streamText.mockReturnValue({
        stream: (async function* () {
            for (const toolName of mode === "last-tool" ? ["first"] : ["first", "later"]) {
                yield {type: "tool-call", toolCallId: toolName, toolName, input: {}};
            }
            yield {type: "finish", finishReason: "tool-calls", totalUsage: {}};
        })()
    });
    let stored: ExportedMessageRepository = {headId: null, messages: []};
    const history: ThreadHistoryAdapter = {
        async load() {
            return stored;
        },
        async append(item) {
            stored = {
                headId: item.message.id,
                messages: [
                    ...stored.messages.filter(({message}) => message.id !== item.message.id),
                    item
                ]
            };
        }
    };
    vi.mocked(ThreadStore.updateThread).mockImplementation(async (_id, updater) => {
        const update = await updater({
            remoteId: "graceful-thread",
            status: "regular",
            exportedMessageRepository: stored,
            custom: {createdAt: new Date(), updatedAt: new Date(), createdByPluginVersion: "test"}
        });
        if (update.type === "save") stored = update.threadData.exportedMessageRepository!;
        return update.result;
    });
    const core = new LocalRuntimeCore(
        {
            adapters: {
                chatModel: withRoundtripPersistence(
                    LocalAISDKChatModelAdapter,
                    history,
                    "graceful-thread"
                ),
                history
            },
            maxSteps: 10
        },
        undefined
    );
    const assistant = new AssistantRuntimeImpl(core);
    assistant.registerModelContextProvider({
        getModelContext: () => ({
            config: {modelName: "test"},
            tools: {
                first: {
                    type: "frontend",
                    parameters: {type: "object", properties: {}},
                    execute,
                    ...(mode === "normalization" ? {toModelOutput} : {})
                },
                later: {
                    type: "frontend",
                    parameters: {type: "object", properties: {}},
                    execute: laterExecute
                }
            }
        })
    });
    const runtime = assistant.thread;
    runtime.append("run tools");
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    const artifact = {type: "test-artifact", value: "preserve me"};
    if (mode === "normalization") {
        execution.resolve(new ToolResponse({result: {success: true}, artifact}));
        await vi.waitFor(() => expect(toModelOutput).toHaveBeenCalledOnce());
    }

    const cancel = vi.spyOn(runtime, "cancelRun");
    let stopped = false;
    const stop = stopThreadRun({threadId: "graceful-thread", runtime}).then((result) => {
        stopped = true;
        return result;
    });
    const duplicate = stopThreadRun({threadId: "graceful-thread", runtime});
    await Promise.resolve();
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(11_000);
    expect(stopped).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    expect(toolSignal?.aborted).toBe(false);
    vi.useRealTimers();

    if (mode === "failure") execution.reject(new Error("real tool failure"));
    else if (mode === "normalization") normalization.resolve([{type: "text", text: "normalized"}]);
    else execution.resolve(new ToolResponse({result: {success: true}, artifact}));
    await expect(stop).resolves.toEqual({didStop: true});
    await duplicate;

    expect(streamText).toHaveBeenCalledOnce();
    expect(laterExecute).not.toHaveBeenCalled();
    expect(runtime.getState().isRunning).toBe(false);
    for (const repository of [runtime.export(), stored]) {
        const message = repository.messages.findLast(
            ({message}) => message.role === "assistant"
        )?.message;
        expect(message?.status).toEqual({type: "incomplete", reason: "cancelled"});
        expect(message?.content[0]).toMatchObject(
            mode === "failure"
                ? {result: {success: false, error: "real tool failure"}, isError: true}
                : {result: {success: true}, artifact}
        );
        if (mode !== "last-tool") {
            expect(message?.content[1]).toMatchObject({
                result: {success: false, error: "User terminated the operation"},
                isError: true
            });
        }
    }
});

test("LocalRuntime still aborts promptly while the model is generating", async () => {
    let modelSignal: AbortSignal | undefined;
    streamText.mockImplementation(({abortSignal}) => {
        modelSignal = abortSignal;
        return {
            stream: (async function* () {
                yield {type: "text-delta", text: "Generating"};
                await new Promise<void>((resolve) =>
                    abortSignal.addEventListener("abort", () => resolve(), {once: true})
                );
                yield {type: "abort"};
            })()
        };
    });
    vi.mocked(ThreadStore.updateThread).mockImplementation(async (_id, updater) => {
        const update = await updater(null);
        return update.result;
    });
    const core = new LocalRuntimeCore(
        {
            adapters: {
                chatModel: withRoundtripPersistence(
                    LocalAISDKChatModelAdapter,
                    {load: async () => ({headId: null, messages: []}), append: async () => {}},
                    "model-thread"
                )
            }
        },
        undefined
    );
    const assistant = new AssistantRuntimeImpl(core);
    assistant.registerModelContextProvider({
        getModelContext: () => ({config: {modelName: "test"}})
    });
    assistant.thread.append("generate");
    await vi.waitFor(() => expect(modelSignal).toBeDefined());
    await expect(
        stopThreadRun({threadId: "model-thread", runtime: assistant.thread})
    ).resolves.toEqual({didStop: true});
    expect(modelSignal?.aborted).toBe(true);
    expect(assistant.thread.getState().isRunning).toBe(false);
    expect(streamText).toHaveBeenCalledOnce();
});
