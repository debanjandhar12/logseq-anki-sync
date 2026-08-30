import {beforeEach, describe, expect, test, vi} from "vitest";
import {createLLMModel} from "../../../../src/core/ai-sdk/getLLMModel";
import {ProviderTypeEnum} from "../../../../src/core/ai-sdk/types";

const mocks = vi.hoisted(() => ({
    createOpenAI: vi.fn(),
    createOpenAICompatible: vi.fn(),
    createGoogle: vi.fn(),
    getRuntimeSession: vi.fn()
}));

vi.mock("@ai-sdk/openai", () => ({createOpenAI: mocks.createOpenAI}));
vi.mock("@ai-sdk/openai-compatible", () => ({
    createOpenAICompatible: mocks.createOpenAICompatible
}));
vi.mock("@ai-sdk/google", () => ({createGoogleGenerativeAI: mocks.createGoogle}));
vi.mock("../../../../src/core/ai-sdk/codex/CodexSessionManager", () => ({
    CodexSessionManager: {getRuntimeSession: mocks.getRuntimeSession}
}));

describe("createLLMModel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createOpenAI.mockReturnValue({responses: vi.fn().mockReturnValue("openai-model")});
        mocks.createOpenAICompatible.mockReturnValue({
            chatModel: vi.fn().mockReturnValue("compatible-model")
        });
        mocks.createGoogle.mockReturnValue({chat: vi.fn().mockReturnValue("google-model")});
        mocks.getRuntimeSession.mockReturnValue({
            aiProvider: {responses: vi.fn().mockReturnValue("codex-model")}
        });
    });

    test.each([
        [ProviderTypeEnum.OPENAI, "openai-model"],
        [ProviderTypeEnum.OPENAI_COMPATIBLE, "compatible-model"],
        [ProviderTypeEnum.GOOGLE, "google-model"]
    ])("passes credentials, base URL, and raw model ID for %s", (type, expected) => {
        const result = createLLMModel({
            config: {
                id: "config-name",
                type,
                baseUrl: "https://provider.test/v1",
                apiKey: "secret",
                models: [{id: "raw-model", enabled: true}]
            },
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

    test("uses the OAuth session for Codex without passing the envelope as an API key", () => {
        const config = {
            id: "codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: "https://chatgpt.com/backend-api/codex",
            apiKey: "encoded-credentials",
            models: [{id: "gpt-5", enabled: true}]
        };
        expect(createLLMModel({config, rawModelId: "gpt-5"})).toBe("codex-model");
        expect(mocks.getRuntimeSession).toHaveBeenCalledWith(config);
        expect(mocks.createOpenAI).not.toHaveBeenCalled();
    });
});
