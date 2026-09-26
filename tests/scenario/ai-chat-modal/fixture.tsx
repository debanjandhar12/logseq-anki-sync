import type {MockLanguageModelV4} from "ai/test";
import {test as baseTest} from "vitest";
import {
    createMultiTurnMockLanguageModel,
    type MockLanguageModelTurn
} from "../../helpers/mockLanguageModel";

type ModelFixture = {
    respondWith: (turns: readonly MockLanguageModelTurn[]) => MockLanguageModelV4;
};

type CreateLLMModelMock = {
    mockReset: () => unknown;
    mockReturnValue: (model: MockLanguageModelV4) => unknown;
};

export function createAIChatScenarioTest(createLLMModelMock: CreateLLMModelMock) {
    return baseTest.extend<{model: ModelFixture}>({
        model: async ({task}, use) => {
            void task;
            createLLMModelMock.mockReset();

            try {
                await use({
                    respondWith(turns) {
                        const model = createMultiTurnMockLanguageModel(turns);
                        createLLMModelMock.mockReturnValue(model);
                        return model;
                    }
                });
            } finally {
                createLLMModelMock.mockReset();
            }
        }
    });
}
