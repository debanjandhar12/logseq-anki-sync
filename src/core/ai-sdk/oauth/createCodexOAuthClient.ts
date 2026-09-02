import {
    type AuthClient,
    type AuthStorage,
    createBrowserAuthClient,
    ProviderId,
    publicClientIds
} from "@ai-oauth-sdk/browser";
import type {OAuthProviderConfig} from "../types";

export function createCodexOAuthClient(
    config: OAuthProviderConfig,
    storage: AuthStorage
): AuthClient {
    return createBrowserAuthClient({
        provider: ProviderId.OpenAI,
        clientId: publicClientIds.openai,
        accountKey: config.uuid,
        storage,
        fetch: globalThis.fetch.bind(globalThis)
    });
}
