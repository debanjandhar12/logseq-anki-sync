import {SELECTED_MODEL_ID_DELIMITER} from "src/core/ai-sdk/provider-config/selectedModelId";
import {validateProviderBaseUrl} from "src/core/ai-sdk/provider-config/validateProviderConfig";
import {type ProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import type {EditableProviderConfig, ProviderConfigValidationIssue} from "./types";

const SUPPORTED_PROVIDER_TYPES = new Set<ProviderTypeEnum>([
    ProviderTypeEnum.OPENAI,
    ProviderTypeEnum.OPENAI_COMPATIBLE,
    ProviderTypeEnum.GOOGLE
]);

function isValidBaseUrl(value: string): boolean {
    try {
        validateProviderBaseUrl(value);
        return true;
    } catch {
        return false;
    }
}

export function validateProviderConfigs(
    configs: EditableProviderConfig[]
): ProviderConfigValidationIssue[] {
    const issues: ProviderConfigValidationIssue[] = [];
    const idCounts = new Map<string, number>();

    for (const config of configs) {
        const normalizedId = config.id.trim().toLowerCase();
        idCounts.set(normalizedId, (idCounts.get(normalizedId) ?? 0) + 1);
    }

    for (const config of configs) {
        const trimmedId = config.id.trim();
        if (!trimmedId) {
            issues.push({
                editorKey: config.editorKey,
                field: "id",
                message: "Configuration ID is required."
            });
        } else if (config.id !== config.id.toLowerCase()) {
            issues.push({
                editorKey: config.editorKey,
                field: "id",
                message: "Configuration ID must be lowercase."
            });
        } else if (trimmedId.includes(SELECTED_MODEL_ID_DELIMITER)) {
            issues.push({
                editorKey: config.editorKey,
                field: "id",
                message: `Configuration ID cannot contain ${SELECTED_MODEL_ID_DELIMITER}.`
            });
        } else if ((idCounts.get(trimmedId.toLowerCase()) ?? 0) > 1) {
            issues.push({
                editorKey: config.editorKey,
                field: "id",
                message: "Configuration ID must be unique."
            });
        }

        if (!SUPPORTED_PROVIDER_TYPES.has(config.type)) {
            issues.push({
                editorKey: config.editorKey,
                field: "type",
                message: "Select a supported provider type."
            });
        }
        if (!isValidBaseUrl(config.baseUrl.trim())) {
            issues.push({
                editorKey: config.editorKey,
                field: "baseUrl",
                message: "Enter a valid HTTP or HTTPS Base URL without embedded credentials."
            });
        }
        if (!config.apiKey.trim()) {
            issues.push({
                editorKey: config.editorKey,
                field: "apiKey",
                message: "API key is required."
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
    return configs.map(({editorKey: _editorKey, originalId: _originalId, ...config}) => ({
        ...config,
        id: config.id.trim().toLowerCase(),
        baseUrl: validateProviderBaseUrl(config.baseUrl),
        models: config.models.map((model) => ({...model, id: model.id.trim()}))
    }));
}

export function getProviderConfigsSnapshot(configs: EditableProviderConfig[]): string {
    return JSON.stringify(configs.map(({editorKey: _editorKey, ...config}) => config));
}
