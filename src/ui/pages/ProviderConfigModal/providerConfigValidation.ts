import {DEFAULT_CODEX_BASE_URL} from "src/core/ai-sdk/provider-config/constants";
import {validateProviderBaseUrl} from "src/core/ai-sdk/provider-config/validateProviderConfig";
import {isOAuthProviderConfig, type ProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import type {EditableProviderConfig, ProviderConfigValidationIssue} from "./types";

const SUPPORTED_PROVIDER_TYPES = new Set<ProviderTypeEnum>(Object.values(ProviderTypeEnum));

function normalizedBaseUrl(value: string): string | null {
    try {
        return validateProviderBaseUrl(value);
    } catch {
        return null;
    }
}

export function validateProviderConfigs(
    configs: EditableProviderConfig[],
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean
): ProviderConfigValidationIssue[] {
    if (configs.length === 0) {
        return [
            {
                editorKey: "",
                field: "name",
                message: "At least one provider configuration is required."
            }
        ];
    }

    const issues: ProviderConfigValidationIssue[] = [];
    const nameCounts = new Map<string, number>();
    for (const config of configs) {
        const name = config.name.trim().toLowerCase();
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }

    for (const config of configs) {
        const name = config.name.trim();
        if (!name) {
            issues.push({
                editorKey: config.editorKey,
                field: "name",
                message: "Configuration name is required."
            });
        } else if ((nameCounts.get(name.toLowerCase()) ?? 0) > 1) {
            issues.push({
                editorKey: config.editorKey,
                field: "name",
                message: "Configuration name must be unique."
            });
        }

        if (!SUPPORTED_PROVIDER_TYPES.has(config.type)) {
            issues.push({
                editorKey: config.editorKey,
                field: "type",
                message: "Select a supported provider type."
            });
        }
        const baseUrl = normalizedBaseUrl(config.baseUrl);
        if (!baseUrl) {
            issues.push({
                editorKey: config.editorKey,
                field: "baseUrl",
                message: "Enter a valid HTTP or HTTPS Base URL without embedded credentials."
            });
        } else if (isOAuthProviderConfig(config) && baseUrl !== DEFAULT_CODEX_BASE_URL) {
            issues.push({
                editorKey: config.editorKey,
                field: "baseUrl",
                message: "Codex Subscription uses a fixed Base URL."
            });
        }
        if (!isOAuthProviderConfig(config) && !config.apiKey.trim()) {
            issues.push({
                editorKey: config.editorKey,
                field: "apiKey",
                message: "API key is required."
            });
        } else if (isOAuthProviderConfig(config) && !isOAuthSignedIn(config)) {
            issues.push({
                editorKey: config.editorKey,
                field: "authentication",
                message: "Sign in to Codex Subscription first."
            });
        }

        const modelCounts = new Map<string, number>();
        for (const model of config.models) {
            const modelId = model.id.trim();
            modelCounts.set(modelId, (modelCounts.get(modelId) ?? 0) + 1);
        }
        config.models.forEach((model, modelIndex) => {
            const modelId = model.id.trim();
            if (!modelId) {
                issues.push({
                    editorKey: config.editorKey,
                    field: "models",
                    modelIndex,
                    message: "Model ID cannot be blank."
                });
            } else if ((modelCounts.get(modelId) ?? 0) > 1) {
                issues.push({
                    editorKey: config.editorKey,
                    field: "models",
                    modelIndex,
                    message: "Model IDs must be unique within a configuration."
                });
            }
        });
        if (!config.models.some((model) => model.enabled && model.id.trim())) {
            issues.push({
                editorKey: config.editorKey,
                field: "models",
                message: "Enable at least one model."
            });
        }
    }
    return issues;
}

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

export function getProviderConfigsSnapshot(configs: EditableProviderConfig[]): string {
    return JSON.stringify(configs.map(({editorKey: _editorKey, ...config}) => config));
}
