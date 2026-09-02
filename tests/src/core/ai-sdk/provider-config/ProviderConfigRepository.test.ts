import {beforeEach, describe, expect, test, vi} from "vitest";
import {ProviderConfigRepository} from "../../../../../src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {
    decodeProviderConfigs,
    encodeProviderConfigs
} from "../../../../../src/core/ai-sdk/provider-config/providerConfigCodec";
import {
    type ApiKeyProviderConfig,
    type OAuthProviderConfig,
    ProviderTypeEnum
} from "../../../../../src/core/ai-sdk/types";

const CODEX_UUID = "10000000-0000-4000-8000-000000000001";
const API_UUID = "10000000-0000-4000-8000-000000000002";

const mocks = vi.hoisted(() => ({
    settings: {} as {providerConfigSetting?: string; selectedModelId?: string},
    updatePluginSettings: vi.fn()
}));

vi.mock("../../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: {
        getPluginSettings: () => mocks.settings,
        updatePluginSettings: mocks.updatePluginSettings
    }
}));

function oauthConfig(overrides: Partial<OAuthProviderConfig> = {}): OAuthProviderConfig {
    return {
        uuid: CODEX_UUID,
        name: "Codex",
        type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
        baseUrl: "https://chatgpt.com/backend-api/codex",
        oauthStorage: {accessToken: "access-1", refreshToken: "refresh-1"},
        models: [{id: "gpt-5", enabled: true}],
        ...overrides
    };
}

function apiConfig(overrides: Partial<ApiKeyProviderConfig> = {}): ApiKeyProviderConfig {
    return {
        uuid: API_UUID,
        name: "OpenAI",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "secret",
        models: [{id: "gpt-5", enabled: true}],
        ...overrides
    };
}

describe("ProviderConfigRepository", () => {
    beforeEach(() => {
        mocks.settings = {};
        mocks.updatePluginSettings.mockReset();
        mocks.updatePluginSettings.mockImplementation(async (patch) => {
            Object.assign(mocks.settings, patch);
        });
    });

    test("reads the embedded provider configurations from settings", () => {
        const configs = [oauthConfig(), apiConfig()];
        mocks.settings.providerConfigSetting = encodeProviderConfigs(configs);

        expect(ProviderConfigRepository.read()).toEqual(configs);
        mocks.settings.providerConfigSetting = undefined;
        expect(ProviderConfigRepository.read()).toEqual([]);
    });

    test("updates only the target OAuth storage", async () => {
        const codex = oauthConfig();
        const api = apiConfig();
        mocks.settings.providerConfigSetting = encodeProviderConfigs([codex, api]);

        await ProviderConfigRepository.updateOAuthStorage(codex.uuid, (storage) => ({
            ...storage,
            accessToken: "access-2"
        }));

        expect(decodeProviderConfigs(mocks.settings.providerConfigSetting ?? "")).toEqual([
            {...codex, oauthStorage: {...codex.oauthStorage, accessToken: "access-2"}},
            api
        ]);
    });

    test("rejects OAuth updates for missing and API-key providers", async () => {
        mocks.settings.providerConfigSetting = encodeProviderConfigs([apiConfig()]);

        await expect(
            ProviderConfigRepository.updateOAuthStorage(API_UUID, (storage) => storage)
        ).rejects.toThrow("OAuth provider configuration is unavailable");
        await expect(
            ProviderConfigRepository.updateOAuthStorage(CODEX_UUID, (storage) => storage)
        ).rejects.toThrow("OAuth provider configuration is unavailable");
    });

    test("preserves storage changed while an unmodified modal draft was open", async () => {
        const draft = oauthConfig();
        const refreshed = oauthConfig({oauthStorage: {accessToken: "access-2"}});
        mocks.settings.providerConfigSetting = encodeProviderConfigs([refreshed]);

        await ProviderConfigRepository.save([
            {config: {...draft, models: [{id: "gpt-5.1", enabled: true}]}}
        ]);

        expect(decodeProviderConfigs(mocks.settings.providerConfigSetting ?? "")).toEqual([
            {...refreshed, models: [{id: "gpt-5.1", enabled: true}]}
        ]);
    });

    test("applies an explicit storage replacement", async () => {
        const codex = oauthConfig();
        mocks.settings.providerConfigSetting = encodeProviderConfigs([codex]);

        await ProviderConfigRepository.save([
            {
                config: codex,
                oauthStorageMutation: {kind: "replace", oauthStorage: {accessToken: "new"}}
            }
        ]);
        expect(ProviderConfigRepository.read()[0]).toMatchObject({
            oauthStorage: {accessToken: "new"}
        });
    });

    test("compare-and-set does not overwrite a concurrent OAuth refresh", async () => {
        const baseline = {accessToken: "access-1", refreshToken: "refresh-1"};
        const refreshed = oauthConfig({oauthStorage: {accessToken: "runtime-refresh"}});
        mocks.settings.providerConfigSetting = encodeProviderConfigs([refreshed]);

        await ProviderConfigRepository.save([
            {
                config: oauthConfig(),
                oauthStorageMutation: {
                    kind: "compare-and-set",
                    baseline,
                    oauthStorage: {accessToken: "modal-login"}
                }
            }
        ]);

        expect(ProviderConfigRepository.read()[0]).toMatchObject({
            oauthStorage: {accessToken: "runtime-refresh"}
        });
    });

    test("reconciles selection using provider UUID and model ID", async () => {
        mocks.settings.selectedModelId = `${CODEX_UUID}////missing`;

        await ProviderConfigRepository.save([{config: apiConfig()}]);

        expect(mocks.settings.selectedModelId).toBe(`${API_UUID}////gpt-5`);
    });
});
