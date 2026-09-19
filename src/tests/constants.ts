import {encodeProviderConfigs} from "../core/ai-sdk/provider-config/providerConfigCodec";
import {ProviderTypeEnum} from "../core/ai-sdk/types";
import type {PluginSettings} from "../settings";

export const MOCK_LOGSEQ_SETTINGS: PluginSettings = {
    disabled: false,
    jinaApiKey: "",
    providerConfigSetting: encodeProviderConfigs([
        {
            uuid: "00000000-0000-4000-8000-000000000001",
            name: "Test provider",
            type: ProviderTypeEnum.OPENAI_COMPATIBLE,
            baseUrl: "https://provider.test/v1",
            apiKey: "test-key",
            models: [{id: "test-model", enabled: true}]
        },
        {
            uuid: "00000000-0000-4000-8000-000000000002",
            name: "Test provider 2",
            type: ProviderTypeEnum.OPENAI_COMPATIBLE,
            baseUrl: "https://provider2.test/v1",
            apiKey: "test-key",
            models: [{id: "test-model2", enabled: true}]
        }
    ])
};
