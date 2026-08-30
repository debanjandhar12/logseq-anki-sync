import {type ProviderConfig, ProviderTypeEnum} from "../types";

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
    if (!config.apiKey.trim()) throw new Error("Provider API key is required");
    validateProviderBaseUrl(config.baseUrl);
}
