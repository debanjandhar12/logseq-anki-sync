import type {EditableProviderConfig} from "../types";
import {validateProviderConfigAuthentication} from "./validateProviderConfigAuthentication";
import {validateProviderConfigBaseUrl} from "./validateProviderConfigBaseUrl";
import {validateProviderConfigEnabledModel} from "./validateProviderConfigEnabledModel";

export interface ProviderConfigActionValidationOptions {
    requireEnabledModel: boolean;
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean;
}

export function getProviderConfigActionValidationMessage(
    config: EditableProviderConfig,
    {requireEnabledModel, isOAuthSignedIn}: ProviderConfigActionValidationOptions
): string | null {
    if (!validateProviderConfigBaseUrl(config.baseUrl).valid) {
        return "Enter a valid Base URL first.";
    }

    const authentication = validateProviderConfigAuthentication(config, isOAuthSignedIn);
    if (authentication.valid === false) {
        return authentication.reason === "api-key-required"
            ? "Enter an API key first."
            : "Sign in first.";
    }

    if (requireEnabledModel && !validateProviderConfigEnabledModel(config).valid) {
        return "Enable at least one model first.";
    }
    return null;
}
