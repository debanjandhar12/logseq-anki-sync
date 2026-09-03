import {validateProviderBaseUrl} from "src/core/ai-sdk/provider-config/validateProviderConfig";
import {isOAuthProviderConfig, type ProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import type {EditableProviderConfig} from "./types";

export function toPersistedProviderConfigs(configs: EditableProviderConfig[]): ProviderConfig[] {
    return configs.map(({editorKey: _editorKey, ...config}) => {
        const common = {
            uuid: config.uuid,
            name: config.name.trim(),
            baseUrl: validateProviderBaseUrl(config.baseUrl),
            models: config.models.map((model) => ({...model, id: model.id.trim()}))
        };
        return isOAuthProviderConfig(config)
            ? {
                  ...common,
                  type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                  oauthStorage: {...config.oauthStorage}
              }
            : {...common, type: config.type, apiKey: config.apiKey.trim()};
    });
}
