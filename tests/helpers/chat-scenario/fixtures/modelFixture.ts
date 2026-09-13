import type {ChatModelAdapter} from "@assistant-ui/react";
import {vi} from "vitest";
import {runLocalAISDKChatModel} from "../../../../src/chat-app/runtime/LocalChatModelAdapter/runLocalAISDKChatModel";
import {LocalThreadListAdapter} from "../../../../src/chat-app/runtime/LocalThreadListAdapter";
import {LogseqCommitChangesTool} from "../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {createMultiTurnMockLanguageModel} from "../../mock-language-model/createMultiTurnMockLanguageModel";
import type {ControlledMockLanguageModel, ModelStep} from "../../mock-language-model/types";
import {createToolExecutionTracker} from "../createToolExecutionTracker";
import {createToolPassthroughSpy} from "../createToolPassthroughSpy";

export const SCENARIO_TITLE = "Deterministic scenario title";
const mocks = vi.hoisted(() => ({generateTitle: vi.fn()}));
vi.mock("../../../../src/core/title-generator/generateTitle", () => ({
    generateTitle: mocks.generateTitle
}));

// Capture once: failed fixture cleanup must not wrap an earlier spy implementation.
const originalGenerateTitle = LocalThreadListAdapter.prototype.generateTitle;

type RunOptions = Parameters<ChatModelAdapter["run"]>[0];
export function createModelFixture() {
    mocks.generateTitle.mockReset().mockResolvedValue(SCENARIO_TITLE);
    const runs: RunOptions[] = [];
    let activeRuns = 0;
    const tools = createToolExecutionTracker();
    // Review work runs outside automatic-tool execution and survives adapter cancellation.
    const reviews = [
        createToolPassthroughSpy(LogseqCommitChangesTool.prototype, "prepareReview"),
        createToolPassthroughSpy(LogseqCommitChangesTool.prototype, "executeApprove"),
        createToolPassthroughSpy(LogseqCommitChangesTool.prototype, "executeCancel")
    ];
    const titles = new Set<Promise<ReadableStream>>();
    const titleSpy = vi
        .spyOn(LocalThreadListAdapter.prototype, "generateTitle")
        .mockImplementation(function (...args) {
            const pending = originalGenerateTitle.apply(this, args);
            titles.add(pending);
            void pending.then(
                () => titles.delete(pending),
                () => titles.delete(pending)
            );
            return pending;
        });
    let languageModel: ControlledMockLanguageModel | undefined;
    const chatModelAdapter: ChatModelAdapter = {
        async *run(options) {
            runs.push(options);
            activeRuns++;
            try {
                const trackedTools = Object.fromEntries(
                    Object.entries(options.context.tools).map(([name, tool]) => {
                        const execute = tool.execute;
                        const trackedTool = {...tool};
                        if (execute)
                            trackedTool.execute = (...args: Parameters<typeof execute>) =>
                                tools.track(() => execute.apply(tool, args));
                        return [name, trackedTool];
                    })
                );
                yield* runLocalAISDKChatModel(
                    {...options, context: {...options.context, tools: trackedTools}},
                    () => {
                        if (!languageModel)
                            throw new Error("Configure model.respondWith before sending");
                        return languageModel;
                    }
                );
            } finally {
                activeRuns--;
            }
        }
    };
    return {
        runs,
        chatModelAdapter,
        respondWith(steps: readonly ModelStep[]) {
            if (languageModel) throw new Error("Configure the complete model script once per test");
            languageModel = createMultiTurnMockLanguageModel(steps);
            return languageModel;
        },
        async waitForSettled() {
            await vi.waitFor(() => {
                if (activeRuns) throw new Error("Model adapter is still running");
            });
            await tools.waitForSettled();
            await Promise.all(reviews.map((review) => review.waitForSettled()));
            await Promise.all([...titles]);
        },
        async dispose() {
            await languageModel?.dispose();
        },
        assertHealthy() {
            languageModel?.assertHealthy();
        },
        restore() {
            for (const review of reviews) review.restore();
            titleSpy.mockRestore();
        }
    };
}

export type ModelFixture = ReturnType<typeof createModelFixture>;
