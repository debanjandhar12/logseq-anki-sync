import {isOAuthProviderConfig} from "src/core/ai-sdk/types";
import type {EditableProviderConfig} from "../types";

export type ProviderConfigAuthenticationValidationResult =
    | {valid: true}
    | {valid: false; reason: "api-key-required" | "oauth-sign-in-required"};

export function validateProviderConfigAuthentication(
    config: EditableProviderConfig,
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean
): ProviderConfigAuthenticationValidationResult {
    if (isOAuthProviderConfig(config)) {
        return isOAuthSignedIn(config)
            ? {valid: true}
            : {valid: false, reason: "oauth-sign-in-required"};
    }
    return config.apiKey.trim() ? {valid: true} : {valid: false, reason: "api-key-required"};
}
