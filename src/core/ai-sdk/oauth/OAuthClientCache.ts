import type {AuthClient} from "@ai-oauth-sdk/browser";
import type {OAuthProviderConfig} from "../types";
import {createCodexOAuthClient} from "./createCodexOAuthClient";
import {ProviderConfigSettingOAuthStorage} from "./ProviderConfigSettingOAuthStorage";

const clients = new Map<string, AuthClient>();

export const OAuthClientCache = {
    get(config: OAuthProviderConfig): AuthClient {
        const cached = clients.get(config.uuid);
        if (cached) return cached;
        const client = createCodexOAuthClient(
            config,
            new ProviderConfigSettingOAuthStorage(config.uuid, () => clients.delete(config.uuid))
        );
        clients.set(config.uuid, client);
        return client;
    },

    invalidate(providerUuid: string): void {
        clients.delete(providerUuid);
    },

    clear(): void {
        clients.clear();
    }
};
