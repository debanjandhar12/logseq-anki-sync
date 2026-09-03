import type {EditableProviderConfig} from "../types";

export type ProviderConfigEnabledModelValidationResult =
    | {valid: true}
    | {valid: false; reason: "enabled-model-required"};

export function validateProviderConfigEnabledModel(
    config: EditableProviderConfig
): ProviderConfigEnabledModelValidationResult {
    return config.models.some((model) => model.enabled && model.id.trim())
        ? {valid: true}
        : {valid: false, reason: "enabled-model-required"};
}
