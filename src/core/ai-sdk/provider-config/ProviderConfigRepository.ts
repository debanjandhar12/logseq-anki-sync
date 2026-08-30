import AsyncLock from "async-lock";
import type {OpenAIOAuthTokens} from "openai-oauth-ai-provider/core";
import {LogseqSettingAccessor} from "../../../logseq/LogseqSettingAccessor";
import {encodeCodexCredentials} from "../codex/CodexCredentialCodec";
import {type ProviderConfig, ProviderTypeEnum} from "../types";
import {decodeProviderConfigs, encodeProviderConfigs} from "./providerConfigCodec";
import {reconcileSelectedModelId} from "./selectedModelId";

type CredentialListener = (update: {providerId: string; encodedCredentials: string}) => void;
export type CodexCredentialIntent = "unchanged" | "replace" | "clear";
export interface ProviderConfigSaveDraft {
    config: ProviderConfig;
    originalId?: string;
    codexCredentialIntent: CodexCredentialIntent;
}
type ProviderSettings = ReturnType<typeof LogseqSettingAccessor.getPluginSettings> & {
    providerConfigSetting?: string;
};

class ProviderConfigRepositoryImpl {
    private readonly lock = new AsyncLock();
    private readonly credentialListeners = new Set<CredentialListener>();

    read(): ProviderConfig[] {
        const encoded = (LogseqSettingAccessor.getPluginSettings() as ProviderSettings)
            .providerConfigSetting;
        return encoded ? decodeProviderConfigs(encoded) : [];
    }

    async save(
        configs: ProviderConfig[],
        renamedIds: Map<string, string> = new Map()
    ): Promise<void> {
        await this.lock.acquire("provider-configs", async () => {
            const settings = LogseqSettingAccessor.getPluginSettings() as ProviderSettings;
            const currentConfigs = settings.providerConfigSetting
                ? decodeProviderConfigs(settings.providerConfigSetting)
                : [];
            const selectedModelId = reconcileSelectedModelId(
                settings.selectedModelId,
                configs,
                renamedIds
            );
            await LogseqSettingAccessor.updatePluginSettings({
                providerConfigSetting: encodeProviderConfigs(configs),
                selectedModelId
            });
            this.publishChangedCodexCredentials(currentConfigs, configs);
        });
    }

    async saveFromModal(
        drafts: ProviderConfigSaveDraft[],
        renamedIds: Map<string, string> = new Map()
    ): Promise<void> {
        await this.lock.acquire("provider-configs", async () => {
            const settings = LogseqSettingAccessor.getPluginSettings() as ProviderSettings;
            const currentConfigs = settings.providerConfigSetting
                ? decodeProviderConfigs(settings.providerConfigSetting)
                : [];
            const configs = drafts.map(({config, originalId, codexCredentialIntent}) => {
                if (
                    config.type !== ProviderTypeEnum.CODEX_SUBSCRIPTION ||
                    codexCredentialIntent !== "unchanged"
                ) {
                    return config;
                }
                const current = currentConfigs.find(
                    (candidate) =>
                        candidate.id === (originalId ?? config.id) &&
                        candidate.type === ProviderTypeEnum.CODEX_SUBSCRIPTION
                );
                if (!current) {
                    throw new Error("Codex Subscription credentials changed while editing");
                }
                return {...config, apiKey: current.apiKey};
            });
            const selectedModelId = reconcileSelectedModelId(
                settings.selectedModelId,
                configs,
                renamedIds
            );
            await LogseqSettingAccessor.updatePluginSettings({
                providerConfigSetting: encodeProviderConfigs(configs),
                selectedModelId
            });
            this.publishChangedCodexCredentials(currentConfigs, configs);
        });
    }

    private publishChangedCodexCredentials(
        previousConfigs: ProviderConfig[],
        nextConfigs: ProviderConfig[]
    ): void {
        const previousById = new Map<string, string>(
            previousConfigs
                .filter((config) => config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION)
                .map((config) => [config.id, config.apiKey])
        );
        const nextById = new Map<string, string>(
            nextConfigs
                .filter((config) => config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION)
                .map((config) => [config.id, config.apiKey])
        );
        for (const providerId of new Set([...previousById.keys(), ...nextById.keys()])) {
            const encodedCredentials = nextById.get(providerId) ?? "";
            if (previousById.get(providerId) === encodedCredentials) continue;
            for (const listener of this.credentialListeners) {
                listener({providerId, encodedCredentials});
            }
        }
    }

    async updateCodexCredentials(
        providerId: string,
        expectedCredentials: string,
        tokens: OpenAIOAuthTokens
    ): Promise<string> {
        return this.lock.acquire("provider-configs", async () => {
            const settings = LogseqSettingAccessor.getPluginSettings() as ProviderSettings;
            const configs = settings.providerConfigSetting
                ? decodeProviderConfigs(settings.providerConfigSetting)
                : [];
            const config = configs.find((candidate) => candidate.id === providerId);
            if (
                config?.type !== ProviderTypeEnum.CODEX_SUBSCRIPTION ||
                config.apiKey !== expectedCredentials
            ) {
                throw new Error("Codex Subscription credentials changed before refresh completed");
            }

            const encodedCredentials = encodeCodexCredentials(tokens);
            config.apiKey = encodedCredentials;
            await LogseqSettingAccessor.updatePluginSettings({
                providerConfigSetting: encodeProviderConfigs(configs)
            });
            for (const listener of this.credentialListeners) {
                listener({providerId, encodedCredentials});
            }
            return encodedCredentials;
        });
    }

    subscribeToCredentialUpdates(listener: CredentialListener): () => void {
        this.credentialListeners.add(listener);
        return () => this.credentialListeners.delete(listener);
    }
}

export const ProviderConfigRepository = new ProviderConfigRepositoryImpl();
