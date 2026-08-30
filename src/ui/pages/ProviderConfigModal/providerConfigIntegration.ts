import {
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_COMPATIBLE_BASE_URL
} from "src/core/ai-sdk/provider-config/constants";
import {fetchProviderModels} from "src/core/ai-sdk/provider-config/fetchProviderModels";
import {mergeProviderModels} from "src/core/ai-sdk/provider-config/mergeProviderModels";
import {
    decodeProviderConfigs,
    encodeProviderConfigs
} from "src/core/ai-sdk/provider-config/providerConfigCodec";
import {reconcileSelectedModelId} from "src/core/ai-sdk/provider-config/selectedModelId";
import {testProviderConfig} from "src/core/ai-sdk/provider-config/testProviderConfig";
import type {ProviderConfig, ProviderModelConfig} from "src/core/ai-sdk/types";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";

type ProviderSettings = ReturnType<typeof LogseqSettingAccessor.getPluginSettings> & {
    providerConfigSetting?: string;
};

export {DEFAULT_GOOGLE_BASE_URL, DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_COMPATIBLE_BASE_URL};

export function loadProviderConfigs(): ProviderConfig[] {
    const settings = LogseqSettingAccessor.getPluginSettings() as ProviderSettings;
    return decodeProviderConfigs(settings.providerConfigSetting ?? encodeProviderConfigs([]));
}

export async function discoverProviderModels(
    config: ProviderConfig
): Promise<ProviderModelConfig[]> {
    const fetchedModels = await fetchProviderModels(config);
    return mergeProviderModels(config.models, fetchedModels);
}

export async function verifyProviderConfig(config: ProviderConfig): Promise<void> {
    await testProviderConfig(config);
}

export async function saveProviderConfigs(
    configs: ProviderConfig[],
    renamedIds: Map<string, string>
): Promise<void> {
    const settings = LogseqSettingAccessor.getPluginSettings() as ProviderSettings;
    const selectedModelId = reconcileSelectedModelId(settings.selectedModelId, configs, renamedIds);
    const patch = {
        providerConfigSetting: encodeProviderConfigs(configs),
        selectedModelId
    };

    await LogseqSettingAccessor.updatePluginSettings(
        patch as Parameters<typeof LogseqSettingAccessor.updatePluginSettings>[0]
    );
}
