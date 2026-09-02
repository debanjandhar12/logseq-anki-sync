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
                uuid: "10000000-0000-4000-8000-000000000001",
                name: "Work",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://work.test/v1",
                apiKey: "secret",
                models: [
                    {id: "gpt-5", enabled: true},
                    {id: "disabled", enabled: false}
                ]
            },
            {
                uuid: "10000000-0000-4000-8000-000000000002",
                name: "Personal",
                type: ProviderTypeEnum.GOOGLE,
                baseUrl: "https://personal.test/v1",
                apiKey: "secret",
                models: [{id: "gemini////pro", enabled: true}]
            }
        ]);

        expect(getLLMModelList()).toEqual([
            {
                id: "10000000-0000-4000-8000-000000000001////gpt-5",
                name: "gpt-5",
                providerConfigUuid: "10000000-0000-4000-8000-000000000001",
                providerConfigName: "Work",
                efforts: true
            },
            {
                id: "10000000-0000-4000-8000-000000000002////gemini////pro",
                name: "gemini////pro",
                providerConfigUuid: "10000000-0000-4000-8000-000000000002",
                providerConfigName: "Personal",
                efforts: true
            }
        ]);
    });
});
