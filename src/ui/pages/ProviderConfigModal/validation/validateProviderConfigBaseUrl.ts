import {validateProviderBaseUrl} from "src/core/ai-sdk/provider-config/validateProviderConfig";

export type ProviderConfigBaseUrlValidationResult =
    | {valid: true; normalizedBaseUrl: string}
    | {valid: false; reason: "invalid-base-url"};

export function validateProviderConfigBaseUrl(
    baseUrl: string
): ProviderConfigBaseUrlValidationResult {
    try {
        return {valid: true, normalizedBaseUrl: validateProviderBaseUrl(baseUrl)};
    } catch {
        return {valid: false, reason: "invalid-base-url"};
    }
}
