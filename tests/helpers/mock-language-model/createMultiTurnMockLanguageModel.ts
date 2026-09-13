import type {LanguageModelV4StreamPart, LanguageModelV4Usage} from "@ai-sdk/provider";
import {MockLanguageModelV4} from "ai/test";
import pTimeout from "p-timeout";
import type {ControlledMockLanguageModel, ModelStep, WaitSegment} from "./types";

function abortError(): DOMException {
    return new DOMException("Mock language model was cancelled", "AbortError");
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function validateSteps(steps: readonly ModelStep[]): void {
    const callIds = new Set<string>();
    for (const [stepIndex, step] of steps.entries()) {
        for (const segment of step.segments) {
            if (segment.type !== "tool-calls") continue;
            if (segment.calls.length === 0) {
                throw new Error(`Mock model step ${stepIndex + 1} has an empty tool-call batch`);
            }
            for (const call of segment.calls) {
                if (callIds.has(call.toolCallId)) {
                    throw new Error(`Duplicate scripted toolCallId: ${call.toolCallId}`);
                }
                callIds.add(call.toolCallId);
            }
        }
    }
}

export function createMultiTurnMockLanguageModel(
    steps: readonly ModelStep[]
): ControlledMockLanguageModel {
    validateSteps(steps);
    let nextStepIndex = 0;
    let disposed = false;
    const failures: unknown[] = [];
    const activeStreams = new Set<{cancel(): void; settled: Promise<void>}>();

    const model = new MockLanguageModelV4({
        doStream: async (options) => {
            if (disposed) throw abortError();
            const stepIndex = nextStepIndex++;
            const step = steps[stepIndex];
            if (!step) {
                const error = new Error(
                    `Mock model script exhausted at call ${stepIndex + 1} (step index ${stepIndex}; ${steps.length} steps)`
                );
                failures.push(error);
                throw error;
            }

            const cancellation = new AbortController();
            const onProviderAbort = () => cancellation.abort();
            const providerSignal = options.abortSignal;
            if (providerSignal?.aborted) cancellation.abort();
            else providerSignal?.addEventListener("abort", onProviderAbort, {once: true});

            const ensureActive = () => {
                if (cancellation.signal.aborted) throw abortError();
            };
            const wait = async (segment: WaitSegment) => {
                ensureActive();
                // Start observing the promise before the checkpoint callback can abort or throw.
                const pending = pTimeout(segment.until, {
                    milliseconds: Infinity,
                    signal: cancellation.signal
                });
                try {
                    segment.onReached?.();
                } catch (error) {
                    cancellation.abort();
                    await pending.catch(() => {});
                    throw error;
                }
                await pending;
                ensureActive();
            };

            let readerCancelled = false;
            let active: {cancel(): void; settled: Promise<void>};
            const stream = new ReadableStream<LanguageModelV4StreamPart>({
                start(controller) {
                    const enqueue = (part: LanguageModelV4StreamPart) => {
                        ensureActive();
                        controller.enqueue(part);
                    };
                    const produce = async () => {
                        try {
                            ensureActive();
                            for (const [segmentIndex, segment] of step.segments.entries()) {
                                ensureActive();
                                if (segment.type === "wait") {
                                    await wait(segment);
                                } else if (segment.type === "tool-calls") {
                                    for (const call of segment.calls) {
                                        enqueue({
                                            type: "tool-call",
                                            ...call,
                                            input: JSON.stringify(call.input)
                                        });
                                    }
                                } else {
                                    const id = `${segment.type}-${stepIndex}-${segmentIndex}`;
                                    enqueue({type: `${segment.type}-start`, id});
                                    for (const chunk of segment.chunks) {
                                        if (typeof chunk === "string") {
                                            enqueue({
                                                type: `${segment.type}-delta`,
                                                id,
                                                delta: chunk
                                            });
                                        } else {
                                            await wait(chunk);
                                        }
                                    }
                                    enqueue({type: `${segment.type}-end`, id});
                                }
                            }
                            const usage: LanguageModelV4Usage = {
                                inputTokens: {total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0},
                                outputTokens: {total: 0, text: 0, reasoning: 0}
                            };
                            enqueue({
                                type: "finish",
                                finishReason: {
                                    unified:
                                        step.finishReason ??
                                        (step.segments.some(
                                            (segment) => segment.type === "tool-calls"
                                        )
                                            ? "tool-calls"
                                            : "stop"),
                                    raw: undefined
                                },
                                usage
                            });
                            controller.close();
                        } catch (error) {
                            if (!isAbortError(error)) failures.push(error);
                            if (!readerCancelled) controller.error(error);
                        } finally {
                            providerSignal?.removeEventListener("abort", onProviderAbort);
                            activeStreams.delete(active);
                        }
                    };
                    // Defer production until the stream and its lifecycle tracking exist.
                    active = {
                        cancel: () => cancellation.abort(),
                        settled: Promise.resolve().then(produce)
                    };
                    activeStreams.add(active);
                },
                cancel() {
                    readerCancelled = true;
                    cancellation.abort();
                    return active.settled;
                }
            });
            return {stream, response: {headers: {"x-mock-response": String(stepIndex + 1)}}};
        }
    });

    return Object.assign(model, {
        assertHealthy() {
            if (failures.length > 0) {
                throw new AggregateError(
                    failures,
                    `Mock language model failed: ${failures.map(String).join("; ")}`
                );
            }
        },
        async dispose() {
            disposed = true;
            const pending = [...activeStreams];
            for (const active of pending) active.cancel();
            await Promise.all(pending.map((active) => active.settled));
        }
    });
}
