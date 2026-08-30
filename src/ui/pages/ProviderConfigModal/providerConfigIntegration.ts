import {
    DEFAULT_CODEX_BASE_URL,
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_COMPATIBLE_BASE_URL
} from "src/core/ai-sdk/provider-config/constants";
import {fetchProviderModels} from "src/core/ai-sdk/provider-config/fetchProviderModels";
import {mergeProviderModels} from "src/core/ai-sdk/provider-config/mergeProviderModels";
import {
    ProviderConfigRepository,
    type ProviderConfigSaveDraft
} from "src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {testProviderConfig} from "src/core/ai-sdk/provider-config/testProviderConfig";
import type {ProviderConfig, ProviderModelConfig} from "src/core/ai-sdk/types";

export {
    DEFAULT_CODEX_BASE_URL,
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_COMPATIBLE_BASE_URL
};

export function loadProviderConfigs(): ProviderConfig[] {
    return ProviderConfigRepository.read();
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
    configs: ProviderConfigSaveDraft[],
    renamedIds: Map<string, string>
): Promise<void> {
    await ProviderConfigRepository.saveFromModal(configs, renamedIds);
}

export const subscribeToCodexCredentialUpdates =
    ProviderConfigRepository.subscribeToCredentialUpdates.bind(ProviderConfigRepository);
