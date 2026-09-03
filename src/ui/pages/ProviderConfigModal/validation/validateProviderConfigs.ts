import {DEFAULT_CODEX_BASE_URL} from "src/core/ai-sdk/provider-config/constants";
import {isOAuthProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import type {EditableProviderConfig, ProviderConfigValidationIssue} from "../types";
import {validateProviderConfigAuthentication} from "./validateProviderConfigAuthentication";
import {validateProviderConfigBaseUrl} from "./validateProviderConfigBaseUrl";
import {validateProviderConfigEnabledModel} from "./validateProviderConfigEnabledModel";

const SUPPORTED_PROVIDER_TYPES = new Set<ProviderTypeEnum>(Object.values(ProviderTypeEnum));

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

        const baseUrl = validateProviderConfigBaseUrl(config.baseUrl);
        if (!baseUrl.valid) {
            issues.push({
                editorKey: config.editorKey,
                field: "baseUrl",
                message: "Enter a valid HTTP or HTTPS Base URL without embedded credentials."
            });
        } else if (
            isOAuthProviderConfig(config) &&
            baseUrl.normalizedBaseUrl !== DEFAULT_CODEX_BASE_URL
        ) {
            issues.push({
                editorKey: config.editorKey,
                field: "baseUrl",
                message: "Codex Subscription uses a fixed Base URL."
            });
        }

        const authentication = validateProviderConfigAuthentication(config, isOAuthSignedIn);
        if (authentication.valid === false) {
            issues.push(
                authentication.reason === "api-key-required"
                    ? {
                          editorKey: config.editorKey,
                          field: "apiKey",
                          message: "API key is required."
                      }
                    : {
                          editorKey: config.editorKey,
                          field: "authentication",
                          message: "Sign in to Codex Subscription first."
                      }
            );
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
        if (!validateProviderConfigEnabledModel(config).valid) {
            issues.push({
                editorKey: config.editorKey,
                field: "models",
                message: "Enable at least one model."
            });
        }
    }
    return issues;
}
