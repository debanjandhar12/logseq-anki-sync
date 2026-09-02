import AsyncLock from "async-lock";
import {LogseqSettingAccessor} from "../../../logseq/LogseqSettingAccessor";
import {isOAuthProviderConfig, type OAuthProviderConfig, type ProviderConfig} from "../types";
import {decodeProviderConfigs, encodeProviderConfigs} from "./providerConfigCodec";
import {reconcileSelectedModelId} from "./selectedModelId";

export type OAuthStorageMutation =
    | {kind: "replace"; oauthStorage: Record<string, string>}
    | {
          kind: "compare-and-set";
          baseline: Record<string, string>;
          oauthStorage: Record<string, string>;
      };

export interface ProviderConfigSaveDraft {
    config: ProviderConfig;
    oauthStorageMutation?: OAuthStorageMutation;
}

function storageMatches(left: Record<string, string>, right: Record<string, string>): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

class ProviderConfigRepositoryImpl {
    private readonly lock = new AsyncLock();

    read(): ProviderConfig[] {
        const encoded = LogseqSettingAccessor.getPluginSettings().providerConfigSetting;
        return encoded ? decodeProviderConfigs(encoded) : [];
    }

    async updateOAuthStorage(
        providerUuid: string,
        update: (storage: Record<string, string>) => Record<string, string>
    ): Promise<void> {
        await this.lock.acquire("provider-configs", async () => {
            const settings = LogseqSettingAccessor.getPluginSettings();
            const configs = settings.providerConfigSetting
                ? decodeProviderConfigs(settings.providerConfigSetting)
                : [];
            const config = configs.find((candidate) => candidate.uuid === providerUuid);
            if (!config || !isOAuthProviderConfig(config)) {
                throw new Error("OAuth provider configuration is unavailable");
            }
            config.oauthStorage = update({...config.oauthStorage});
            await LogseqSettingAccessor.updatePluginSettings({
                providerConfigSetting: encodeProviderConfigs(configs)
            });
        });
    }

    async save(drafts: ProviderConfigSaveDraft[]): Promise<void> {
        await this.lock.acquire("provider-configs", async () => {
            const settings = LogseqSettingAccessor.getPluginSettings();
            const currentConfigs = settings.providerConfigSetting
                ? decodeProviderConfigs(settings.providerConfigSetting)
                : [];
            const currentByUuid = new Map(currentConfigs.map((config) => [config.uuid, config]));
            const configs = drafts.map(({config, oauthStorageMutation}) => {
                if (!isOAuthProviderConfig(config)) return config;

                const current = currentByUuid.get(config.uuid);
                const currentIsOAuth = current !== undefined && isOAuthProviderConfig(current);
                const currentStorage = currentIsOAuth ? current.oauthStorage : {};
                return {
                    ...config,
                    oauthStorage: this.resolveOAuthStorage(
                        currentStorage,
                        config.oauthStorage,
                        oauthStorageMutation,
                        currentIsOAuth
                    )
                } satisfies OAuthProviderConfig;
            });
            await LogseqSettingAccessor.updatePluginSettings({
                providerConfigSetting: encodeProviderConfigs(configs),
                selectedModelId: reconcileSelectedModelId(settings.selectedModelId, configs)
            });
        });
    }

    private resolveOAuthStorage(
        current: Record<string, string>,
        draft: Record<string, string>,
        mutation: OAuthStorageMutation | undefined,
        hasCurrentConfig: boolean
    ): Record<string, string> {
        if (!mutation) return hasCurrentConfig ? current : draft;
        if (mutation.kind === "replace") return mutation.oauthStorage;
        return storageMatches(current, mutation.baseline) ? mutation.oauthStorage : current;
    }
}

export const ProviderConfigRepository = new ProviderConfigRepositoryImpl();
