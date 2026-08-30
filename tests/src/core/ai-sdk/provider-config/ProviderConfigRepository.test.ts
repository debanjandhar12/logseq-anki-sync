import {beforeEach, describe, expect, test, vi} from "vitest";
import {encodeCodexCredentials} from "../../../../../src/core/ai-sdk/codex/CodexCredentialCodec";
import {ProviderConfigRepository} from "../../../../../src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {
    decodeProviderConfigs,
    encodeProviderConfigs
} from "../../../../../src/core/ai-sdk/provider-config/providerConfigCodec";
import {type ProviderConfig, ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";

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

const originalTokens = {
    accessToken: "access-1",
    idToken: "id-1",
    refreshToken: "refresh-1",
    updatedAt: 1
};

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: "codex",
        type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
        baseUrl: "https://chatgpt.com/backend-api/codex",
        apiKey: encodeCodexCredentials(originalTokens),
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

    test("updates only the target credentials and publishes the encoded replacement", async () => {
        const codex = config();
        const other = config({
            id: "other",
            type: ProviderTypeEnum.OPENAI,
            baseUrl: "https://api.openai.com/v1",
            apiKey: "other-key"
        });
        mocks.settings.providerConfigSetting = encodeProviderConfigs([codex, other]);
        const listener = vi.fn();
        const unsubscribe = ProviderConfigRepository.subscribeToCredentialUpdates(listener);

        const encoded = await ProviderConfigRepository.updateCodexCredentials(
            codex.id,
            codex.apiKey,
            {...originalTokens, accessToken: "access-2", refreshToken: "refresh-2", updatedAt: 2}
        );

        expect(decodeProviderConfigs(mocks.settings.providerConfigSetting ?? "")).toEqual([
            {...codex, apiKey: encoded},
            other
        ]);
        expect(listener).toHaveBeenCalledWith({providerId: codex.id, encodedCredentials: encoded});
        unsubscribe();
    });

    test.each([
        ["logout", config({apiKey: ""})],
        [
            "replacement",
            config({apiKey: encodeCodexCredentials({...originalTokens, updatedAt: 2})})
        ],
        ["rename", config({id: "renamed"})],
        ["type change", config({type: ProviderTypeEnum.OPENAI, apiKey: "ordinary-key"})]
    ])("rejects a stale refresh after %s", async (_name, changedConfig) => {
        const original = config();
        mocks.settings.providerConfigSetting = encodeProviderConfigs([changedConfig]);
        await expect(
            ProviderConfigRepository.updateCodexCredentials(original.id, original.apiKey, {
                ...originalTokens,
                updatedAt: 3
            })
        ).rejects.toThrow("credentials changed before refresh completed");
        expect(mocks.updatePluginSettings).not.toHaveBeenCalled();
    });

    test("preserves credentials refreshed while an unchanged modal draft was open", async () => {
        const original = config();
        const refreshed = {
            ...original,
            apiKey: encodeCodexCredentials({
                ...originalTokens,
                accessToken: "access-2",
                updatedAt: 2
            })
        };
        mocks.settings.providerConfigSetting = encodeProviderConfigs([refreshed]);

        await ProviderConfigRepository.saveFromModal([
            {
                config: {...original, models: [{id: "gpt-5.1", enabled: true}]},
                originalId: original.id,
                codexCredentialIntent: "unchanged"
            }
        ]);

        expect(decodeProviderConfigs(mocks.settings.providerConfigSetting ?? "")).toEqual([
            {...refreshed, models: [{id: "gpt-5.1", enabled: true}]}
        ]);
    });

    test("an explicit modal logout wins over a prior runtime refresh", async () => {
        const refreshed = config({
            apiKey: encodeCodexCredentials({
                ...originalTokens,
                accessToken: "access-2",
                updatedAt: 2
            })
        });
        mocks.settings.providerConfigSetting = encodeProviderConfigs([refreshed]);

        await ProviderConfigRepository.saveFromModal([
            {
                config: {...refreshed, apiKey: ""},
                originalId: refreshed.id,
                codexCredentialIntent: "clear"
            }
        ]);

        expect(decodeProviderConfigs(mocks.settings.providerConfigSetting ?? "")[0].apiKey).toBe(
            ""
        );
    });
});
