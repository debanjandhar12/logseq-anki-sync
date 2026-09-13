import type {ChatModelAdapter} from "@assistant-ui/react";
import type {MockLanguageModelV4} from "ai/test";
import {test as baseTest, vi} from "vitest";
import {runLocalAISDKChatModel} from "../../src/chat-app/runtime/LocalChatModelAdapter/runLocalAISDKChatModel";
import {createMultiTurnMockLanguageModel, type MockLanguageModelTurn} from "./mockLanguageModel";

type ModelFixture = {
    chatModelAdapter: ChatModelAdapter;
    respondWith: (turns: readonly MockLanguageModelTurn[]) => MockLanguageModelV4;
    waitForTitleGeneration: () => Promise<void>;
};

const mocks = vi.hoisted(() => ({generateTitle: vi.fn()}));

vi.mock("../../src/core/title-generator/generateTitle", () => ({
    generateTitle: mocks.generateTitle
}));

export const test = baseTest.extend<{model: ModelFixture}>({
    model: async ({task}, use) => {
        void task;
        mocks.generateTitle.mockReset();
        mocks.generateTitle.mockResolvedValue("Deterministic scenario title");
        let languageModel: MockLanguageModelV4 | undefined;

        await use({
            chatModelAdapter: {
                run(options) {
                    return runLocalAISDKChatModel(options, () => {
                        if (!languageModel) {
                            throw new Error(
                                "Call model.respondWith() before mounting the chat app"
                            );
                        }
                        return languageModel;
                    });
                }
            },
            respondWith(turns) {
                languageModel = createMultiTurnMockLanguageModel(turns);
                return languageModel;
            },
            async waitForTitleGeneration() {
                await vi.waitFor(() => {
                    if (mocks.generateTitle.mock.calls.length === 0) {
                        throw new Error("Title generation has not started");
                    }
                });
            }
        });
    }
});
