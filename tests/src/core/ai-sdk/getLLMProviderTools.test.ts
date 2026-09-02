import {beforeEach, describe, expect, test, vi} from "vitest";
import {getLLMProviderTools} from "../../../../src/core/ai-sdk/getLLMProviderTools";
import type {ResolvedLLMSelection} from "../../../../src/core/ai-sdk/provider-config/resolveLLMSelection";
import {ProviderTypeEnum, WebToolsProviderEnum} from "../../../../src/core/ai-sdk/types";

const mocks = vi.hoisted(() => ({
    createOpenAI: vi.fn(),
    createGoogle: vi.fn(),
    getOAuthClient: vi.fn(),
    authenticatedFetch: vi.fn(),
    getPluginSettings: vi.fn()
}));

vi.mock("@ai-sdk/openai", () => ({createOpenAI: mocks.createOpenAI}));
vi.mock("@ai-sdk/google", () => ({createGoogleGenerativeAI: mocks.createGoogle}));
vi.mock("@ai-oauth-sdk/browser", () => ({
    createAuthenticatedFetch: vi.fn(() => mocks.authenticatedFetch)
}));
vi.mock("../../../../src/core/ai-sdk/oauth/OAuthClientCache", () => ({
    OAuthClientCache: {get: mocks.getOAuthClient}
}));
vi.mock("../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: {getPluginSettings: mocks.getPluginSettings}
}));

const resolved = (type: ProviderTypeEnum): ResolvedLLMSelection => ({
    config:
        type === ProviderTypeEnum.CODEX_SUBSCRIPTION
            ? {
                  uuid: "10000000-0000-4000-8000-000000000001",
                  name: "Selected",
                  type,
                  baseUrl: "https://chatgpt.com/backend-api/codex",
                  oauthStorage: {accessToken: "stored"},
                  models: [{id: "model", enabled: true}]
              }
            : {
                  uuid: "10000000-0000-4000-8000-000000000001",
                  name: "Selected",
                  type,
                  baseUrl: "https://provider.test/v1",
                  apiKey: "selected-secret",
                  models: [{id: "model", enabled: true}]
              },
    rawModelId: "model"
});

describe("getLLMProviderTools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createOpenAI.mockReturnValue({tools: {webSearch: vi.fn().mockReturnValue("web")}});
        mocks.createGoogle.mockReturnValue({
            tools: {
                googleSearch: vi.fn().mockReturnValue("search"),
                urlContext: vi.fn().mockReturnValue("url")
            }
        });
        mocks.getOAuthClient.mockReturnValue({
            provider: {apiBaseUrl: "https://chatgpt.com/backend-api/codex"}
        });
    });

    test("returns no tools without the global Model Native setting", () => {
        mocks.getPluginSettings.mockReturnValue({webToolsProvider: WebToolsProviderEnum.DISABLED});
        expect(getLLMProviderTools(resolved(ProviderTypeEnum.OPENAI))).toEqual({});
        expect(mocks.createOpenAI).not.toHaveBeenCalled();
    });

    test("uses selected OpenAI configuration credentials", () => {
        mocks.getPluginSettings.mockReturnValue({
            webToolsProvider: WebToolsProviderEnum.MODEL_NATIVE
        });
        expect(getLLMProviderTools(resolved(ProviderTypeEnum.OPENAI))).toEqual({web_search: "web"});
        expect(mocks.createOpenAI).toHaveBeenCalledWith({
            apiKey: "selected-secret",
            baseURL: "https://provider.test/v1"
        });
    });

    test("uses selected Google configuration credentials", () => {
        mocks.getPluginSettings.mockReturnValue({
            webToolsProvider: WebToolsProviderEnum.MODEL_NATIVE
        });
        expect(getLLMProviderTools(resolved(ProviderTypeEnum.GOOGLE))).toEqual({
            google_search: "search",
            url_context: "url"
        });
        expect(mocks.createGoogle).toHaveBeenCalledWith({
            apiKey: "selected-secret",
            baseURL: "https://provider.test/v1"
        });
    });

    test("returns no native tools for OpenAI Compatible", () => {
        mocks.getPluginSettings.mockReturnValue({
            webToolsProvider: WebToolsProviderEnum.MODEL_NATIVE
        });
        expect(getLLMProviderTools(resolved(ProviderTypeEnum.OPENAI_COMPATIBLE))).toEqual({});
    });

    test("uses the OAuth-backed native web search tool for Codex", () => {
        mocks.getPluginSettings.mockReturnValue({
            webToolsProvider: WebToolsProviderEnum.MODEL_NATIVE
        });
        const selection = resolved(ProviderTypeEnum.CODEX_SUBSCRIPTION);
        expect(getLLMProviderTools(selection)).toEqual({web_search: "web"});
        expect(mocks.getOAuthClient).toHaveBeenCalledWith(selection.config);
        expect(mocks.createOpenAI).toHaveBeenCalledWith({
            apiKey: "unused",
            baseURL: "https://chatgpt.com/backend-api/codex",
            fetch: mocks.authenticatedFetch
        });
    });
});
