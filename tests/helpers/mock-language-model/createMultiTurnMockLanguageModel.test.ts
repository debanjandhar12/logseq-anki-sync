// @vitest-environment node
import type {LanguageModelV4StreamPart} from "@ai-sdk/provider";
import {streamText} from "ai";
import {afterEach, describe, expect, it, vi} from "vitest";
import {reasoningSegment} from "./builders/reasoningSegment";
import {textSegment} from "./builders/textSegment";
import {toolCallsSegment} from "./builders/toolCallsSegment";
import {waitSegment} from "./builders/waitSegment";
import {createMultiTurnMockLanguageModel} from "./createMultiTurnMockLanguageModel";
import type {ControlledMockLanguageModel, ModelStep} from "./types";

const models: ControlledMockLanguageModel[] = [];
function createModel(steps: readonly ModelStep[]) {
    const model = createMultiTurnMockLanguageModel(steps);
    models.push(model);
    return model;
}

async function collect(stream: ReadableStream<LanguageModelV4StreamPart>) {
    const reader = stream.getReader();
    const parts: LanguageModelV4StreamPart[] = [];
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) return parts;
            parts.push(next.value);
        }
    } finally {
        reader.releaseLock();
    }
}

afterEach(async () => {
    await Promise.all(models.splice(0).map((model) => model.dispose()));
});

describe("createMultiTurnMockLanguageModel", () => {
    it("lazily emits matching V4 text/reasoning blocks and one finish per provider call", async () => {
        const reached = vi.fn();
        const model = createModel([
            {
                segments: [
                    reasoningSegment(["Thinking", waitSegment(Promise.resolve(), reached), "..."]),
                    textSegment(["Hello", " world"])
                ]
            },
            {segments: [textSegment("Next")], finishReason: "length"}
        ]);
        expect(reached).not.toHaveBeenCalled();
        expect(model.doStreamCalls).toHaveLength(0);
        const first = await model.doStream({prompt: []});
        expect(await collect(first.stream)).toEqual([
            {type: "reasoning-start", id: "reasoning-0-0"},
            {type: "reasoning-delta", id: "reasoning-0-0", delta: "Thinking"},
            {type: "reasoning-delta", id: "reasoning-0-0", delta: "..."},
            {type: "reasoning-end", id: "reasoning-0-0"},
            {type: "text-start", id: "text-0-1"},
            {type: "text-delta", id: "text-0-1", delta: "Hello"},
            {type: "text-delta", id: "text-0-1", delta: " world"},
            {type: "text-end", id: "text-0-1"},
            {
                type: "finish",
                finishReason: {unified: "stop", raw: undefined},
                usage: {
                    inputTokens: {total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0},
                    outputTokens: {total: 0, text: 0, reasoning: 0}
                }
            }
        ]);
        expect(reached).toHaveBeenCalledOnce();
        expect(first.response?.headers).toEqual({"x-mock-response": "1"});
        const second = await collect((await model.doStream({prompt: []})).stream);
        expect(second).toContainEqual({type: "text-delta", id: "text-1-0", delta: "Next"});
        expect(second.at(-1)).toMatchObject({type: "finish", finishReason: {unified: "length"}});
        model.assertHealthy();
    });

    it("emits multiple tool calls in order in a single provider request", async () => {
        const calls = [
            {toolCallId: "p", toolName: "create", input: {pageName: "P"}},
            {toolCallId: "q", toolName: "create", input: {pageName: "Q", nested: {value: 1}}}
        ];
        const model = createModel([{segments: [toolCallsSegment(calls)]}]);
        const parts = await collect((await model.doStream({prompt: []})).stream);
        expect(parts.slice(0, 2)).toEqual(
            calls.map((call) => ({type: "tool-call", ...call, input: JSON.stringify(call.input)}))
        );
        expect(parts).toHaveLength(3);
        expect(parts[2]).toMatchObject({
            type: "finish",
            finishReason: {unified: "tool-calls", raw: undefined}
        });
        expect(model.doStreamCalls).toHaveLength(1);
        model.assertHealthy();
    });

    it("is consumable by the installed AI SDK", async () => {
        const model = createModel([
            {segments: [reasoningSegment("Thinking"), textSegment("Answer")]}
        ]);
        const result = streamText({model, prompt: "Question"});
        expect(await result.text).toBe("Answer");
        expect(await result.reasoningText).toBe("Thinking");
        expect(await result.finishReason).toBe("stop");
        model.assertHealthy();
    });

    it.each([
        false,
        true
    ])("supports controlled waits (released before request: %s)", async (releasedBefore) => {
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const model = createModel([
            {
                segments: [
                    textSegment(["prefix", waitSegment(release.promise, reached.resolve), "suffix"])
                ]
            }
        ]);
        if (releasedBefore) release.resolve();
        const reader = (await model.doStream({prompt: []})).stream.getReader();
        await reached.promise;
        expect((await reader.read()).value).toMatchObject({type: "text-start"});
        expect((await reader.read()).value).toMatchObject({delta: "prefix"});
        const next = reader.read();
        if (!releasedBefore) {
            const settled = vi.fn();
            void next.then(settled);
            await Promise.resolve();
            expect(settled).not.toHaveBeenCalled();
            release.resolve();
        }
        expect((await next).value).toMatchObject({delta: "suffix"});
        expect((await reader.read()).value).toMatchObject({type: "text-end"});
        expect((await reader.read()).value).toMatchObject({type: "finish"});
        expect((await reader.read()).done).toBe(true);
        model.assertHealthy();
    });

    it.each([
        "provider",
        "reader",
        "dispose"
    ] as const)("%s cancellation interrupts a held wait and late release never resumes production", async (cancellation) => {
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const resumed = vi.fn();
        const provider = new AbortController();
        const add = vi.spyOn(provider.signal, "addEventListener");
        const remove = vi.spyOn(provider.signal, "removeEventListener");
        const model = createModel([
            {
                segments: [
                    waitSegment(release.promise, reached.resolve),
                    waitSegment(Promise.resolve(), resumed),
                    textSegment("must not emit")
                ]
            }
        ]);
        const reader = (
            await model.doStream({prompt: [], abortSignal: provider.signal})
        ).stream.getReader();
        await reached.promise;
        const read = reader.read();
        const assertion =
            cancellation === "reader"
                ? expect(read).resolves.toEqual({done: true, value: undefined})
                : expect(read).rejects.toMatchObject({name: "AbortError"});
        if (cancellation === "provider") provider.abort();
        else if (cancellation === "reader") await reader.cancel("test cancellation");
        else await model.dispose();
        await assertion;
        await model.dispose();
        release.resolve();
        await Promise.resolve();
        expect(resumed).not.toHaveBeenCalled();
        expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
        model.assertHealthy();
    });

    it("handles already-aborted requests and refuses requests after disposal", async () => {
        const reached = vi.fn();
        const provider = new AbortController();
        provider.abort();
        const model = createModel([{segments: [waitSegment(Promise.resolve(), reached)]}]);
        const stream = (await model.doStream({prompt: [], abortSignal: provider.signal})).stream;
        await expect(collect(stream)).rejects.toMatchObject({name: "AbortError"});
        expect(reached).not.toHaveBeenCalled();
        await model.dispose();
        await model.dispose();
        await expect(model.doStream({prompt: []})).rejects.toMatchObject({name: "AbortError"});
        model.assertHealthy();
    });

    it.each([
        "release",
        "reject"
    ] as const)("removes provider listeners on normal %s", async (settlement) => {
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const provider = new AbortController();
        const add = vi.spyOn(provider.signal, "addEventListener");
        const remove = vi.spyOn(provider.signal, "removeEventListener");
        const model = createModel([{segments: [waitSegment(release.promise, reached.resolve)]}]);
        const stream = (await model.doStream({prompt: [], abortSignal: provider.signal})).stream;
        const pending = collect(stream);
        await reached.promise;
        const error = new Error("release failed");
        if (settlement === "release") {
            release.resolve();
            await pending;
            model.assertHealthy();
        } else {
            release.reject(error);
            await expect(pending).rejects.toBe(error);
            expect(() => model.assertHealthy()).toThrow("release failed");
        }
        expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
    });

    it("captures checkpoint callback failures for teardown", async () => {
        const error = new Error("checkpoint failed");
        const model = createModel([
            {
                segments: [
                    waitSegment(new Promise<void>(() => {}), () => {
                        throw error;
                    })
                ]
            }
        ]);
        await expect(collect((await model.doStream({prompt: []})).stream)).rejects.toBe(error);
        await model.dispose();
        expect(() => model.assertHealthy()).toThrow("checkpoint failed");
    });

    it("throws explicit exhaustion and retains it after disposal for teardown", async () => {
        const model = createModel([{segments: []}]);
        await collect((await model.doStream({prompt: []})).stream);
        await expect(model.doStream({prompt: []})).rejects.toThrow(
            "call 2 (step index 1; 1 steps)"
        );
        await model.dispose();
        expect(() => model.assertHealthy()).toThrow("script exhausted");
    });

    it("rejects an empty script's first request", async () => {
        const model = createModel([]);
        await expect(model.doStream({prompt: []})).rejects.toThrow(
            "call 1 (step index 0; 0 steps)"
        );
        expect(() => model.assertHealthy()).toThrow("script exhausted");
    });

    it("validates nonempty batches and unique call IDs across the whole script", () => {
        expect(() => createModel([{segments: [toolCallsSegment([])]}])).toThrow(
            "empty tool-call batch"
        );
        const call = {toolCallId: "duplicate", toolName: "create", input: {}};
        expect(() =>
            createModel([
                {segments: [toolCallsSegment([call])]},
                {segments: [toolCallsSegment([call])]}
            ])
        ).toThrow("Duplicate scripted toolCallId: duplicate");
    });
});
