import type {ChatModelAdapter} from "@assistant-ui/react";
import type {MockLanguageModelV4} from "ai/test";
import {test as baseTest} from "vitest";
import {runLocalAISDKChatModel} from "../../../src/chat-app/runtime/LocalChatModelAdapter/runLocalAISDKChatModel";
import {
    createMultiTurnMockLanguageModel,
    type MockLanguageModelTurn
} from "../../helpers/mockLanguageModel";

type ModelFixture = {
    chatModelAdapter: ChatModelAdapter;
    respondWith: (turns: readonly MockLanguageModelTurn[]) => MockLanguageModelV4;
};

export const test = baseTest.extend<{model: ModelFixture}>({
    model: async ({task}, use) => {
        void task;
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
            }
        });
    }
});
