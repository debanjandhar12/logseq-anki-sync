import {beforeEach, describe, expect, test, vi} from "vitest";
import {createLLMModel} from "../../../../src/core/ai-sdk/getLLMModel";
import {
    type ApiKeyProviderConfig,
    type OAuthProviderConfig,
    ProviderTypeEnum
} from "../../../../src/core/ai-sdk/types";

const mocks = vi.hoisted(() => ({
    createOpenAI: vi.fn(),
    createOpenAICompatible: vi.fn(),
    createGoogle: vi.fn(),
    getOAuthClient: vi.fn(),
    authenticatedFetch: vi.fn()
}));

vi.mock("@ai-sdk/openai", () => ({createOpenAI: mocks.createOpenAI}));
vi.mock("@ai-sdk/openai-compatible", () => ({
    createOpenAICompatible: mocks.createOpenAICompatible
}));
vi.mock("@ai-sdk/google", () => ({createGoogleGenerativeAI: mocks.createGoogle}));
vi.mock("@ai-oauth-sdk/browser", () => ({
    createAuthenticatedFetch: vi.fn(() => mocks.authenticatedFetch)
}));
vi.mock("../../../../src/core/ai-sdk/oauth/OAuthClientCache", () => ({
    OAuthClientCache: {get: mocks.getOAuthClient}
}));

describe("createLLMModel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createOpenAI.mockReturnValue({responses: vi.fn().mockReturnValue("openai-model")});
        mocks.createOpenAICompatible.mockReturnValue({
            chatModel: vi.fn().mockReturnValue("compatible-model")
        });
        mocks.createGoogle.mockReturnValue({chat: vi.fn().mockReturnValue("google-model")});
        mocks.getOAuthClient.mockReturnValue({
            provider: {apiBaseUrl: "https://chatgpt.com/backend-api/codex"}
        });
    });

    test.each([
        [ProviderTypeEnum.OPENAI, "openai-model"],
        [ProviderTypeEnum.OPENAI_COMPATIBLE, "compatible-model"],
        [ProviderTypeEnum.GOOGLE, "google-model"]
    ] as const)("passes credentials, base URL, and raw model ID for %s", (type, expected) => {
        const config: ApiKeyProviderConfig = {
            uuid: "10000000-0000-4000-8000-000000000001",
            name: "config-name",
            type,
            baseUrl: "https://provider.test/v1",
            apiKey: "secret",
            models: [{id: "raw-model", enabled: true}]
        };
        const result = createLLMModel({
            config,
            rawModelId: "raw-model"
        });

        expect(result).toBe(expected);
        const factory =
            type === ProviderTypeEnum.OPENAI
                ? mocks.createOpenAI
                : type === ProviderTypeEnum.OPENAI_COMPATIBLE
                  ? mocks.createOpenAICompatible
                  : mocks.createGoogle;
        expect(factory).toHaveBeenCalledWith(
            type === ProviderTypeEnum.OPENAI_COMPATIBLE
                ? {name: "config-name", baseURL: "https://provider.test/v1", apiKey: "secret"}
                : {baseURL: "https://provider.test/v1", apiKey: "secret"}
        );
    });

    test("uses authenticated OAuth fetch for Codex", () => {
        const config: OAuthProviderConfig = {
            uuid: "10000000-0000-4000-8000-000000000002",
            name: "Codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: "https://chatgpt.com/backend-api/codex",
            oauthStorage: {accessToken: "stored"},
            models: [{id: "gpt-5", enabled: true}]
        };
        expect(createLLMModel({config, rawModelId: "gpt-5"})).toBe("openai-model");
        expect(mocks.getOAuthClient).toHaveBeenCalledWith(config);
        expect(mocks.createOpenAI).toHaveBeenCalledWith({
            apiKey: "unused",
            baseURL: "https://chatgpt.com/backend-api/codex",
            fetch: mocks.authenticatedFetch
        });
    });
});
