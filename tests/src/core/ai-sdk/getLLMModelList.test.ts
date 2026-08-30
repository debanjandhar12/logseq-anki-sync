import {beforeEach, describe, expect, test, vi} from "vitest";
import {getLLMModelList} from "../../../../src/core/ai-sdk/getLLMModelList";
import {ProviderTypeEnum} from "../../../../src/core/ai-sdk/types";

const {readProviderConfigs} = vi.hoisted(() => ({readProviderConfigs: vi.fn()}));

vi.mock("../../../../src/core/ai-sdk/provider-config/readProviderConfigs", () => ({
    readProviderConfigs
}));

describe("getLLMModelList", () => {
    beforeEach(() => vi.clearAllMocks());

    test("aggregates enabled models in persisted provider and model order", () => {
        readProviderConfigs.mockReturnValue([
            {
                id: "work",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://work.test/v1",
                apiKey: "secret",
                models: [
                    {id: "gpt-5", enabled: true},
                    {id: "disabled", enabled: false}
                ]
            },
            {
                id: "personal",
                type: ProviderTypeEnum.GOOGLE,
                baseUrl: "https://personal.test/v1",
                apiKey: "secret",
                models: [{id: "gemini////pro", enabled: true}]
            }
        ]);

        expect(getLLMModelList()).toEqual([
            {
                id: "work////gpt-5",
                name: "gpt-5",
                providerConfigId: "work",
                efforts: true
            },
            {
                id: "personal////gemini////pro",
                name: "gemini////pro",
                providerConfigId: "personal",
                efforts: true
            }
        ]);
    });
});
