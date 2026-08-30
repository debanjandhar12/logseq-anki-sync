import {isValidCodexCredentials} from "../codex/CodexCredentialCodec";
import {type ProviderConfig, ProviderTypeEnum} from "../types";
import {DEFAULT_CODEX_BASE_URL} from "./constants";

export function validateProviderBaseUrl(baseUrl: string): string {
    let url: URL;
    try {
        url = new URL(baseUrl.trim());
    } catch {
        throw new Error("Provider Base URL is invalid");
    }
    if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    ) {
        throw new Error("Provider Base URL is invalid");
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function validateProviderConnection(config: ProviderConfig): void {
    if (!Object.values(ProviderTypeEnum).includes(config.type)) {
        throw new Error("Provider type is invalid");
    }
    if (config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
        validateCodexAuthentication(config);
        return;
    }
    if (!config.apiKey.trim()) throw new Error("Provider API key is required");
    validateProviderBaseUrl(config.baseUrl);
}

export function validateCodexAuthentication(config: ProviderConfig): void {
    let validBaseUrl = false;
    try {
        validBaseUrl = validateProviderBaseUrl(config.baseUrl) === DEFAULT_CODEX_BASE_URL;
    } catch {
        // Runtime callers receive one safe authentication/configuration error below.
    }
    if (
        config.type !== ProviderTypeEnum.CODEX_SUBSCRIPTION ||
        !validBaseUrl ||
        !config.apiKey ||
        !isValidCodexCredentials(config.apiKey)
    ) {
        throw new Error("Sign in to Codex Subscription first");
    }
}
