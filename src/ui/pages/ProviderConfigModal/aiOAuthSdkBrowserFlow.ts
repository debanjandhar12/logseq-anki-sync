import {
    type AuthStorage,
    createBrowserAuthClient,
    type DeviceCodeResponse,
    localStorageAdapter,
    loginWithPopup,
    memoryStorage,
    openai,
    ProviderId,
    prefixedStorage,
    publicClientIds,
    sessionStorageAdapter,
    type TokenSet
} from "@ai-oauth-sdk/browser";

export type BrowserOAuthStorageMode = "session" | "local" | "memory";

export type SafeDevicePrompt = {
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresAt: number;
};

const STORAGE_PREFIX = "logseq-ai-chat:codex-browser-oauth:";
export const OPENAI_POPUP_REDIRECT_URI = "http://localhost:1455/auth/callback";

export function createMemoryOAuthStorage(): AuthStorage {
    return prefixedStorage(memoryStorage(), STORAGE_PREFIX);
}

export function createBrowserOAuthStorage(
    mode: BrowserOAuthStorageMode,
    memory: AuthStorage
): AuthStorage {
    if (mode === "memory") return memory;

    const browserStorage =
        mode === "local"
            ? localStorageAdapter()
            : // createBrowserAuthClient defaults to session storage, but selecting it
              // explicitly keeps all experiment storage namespaced consistently.
              sessionStorageAdapter();
    return prefixedStorage(browserStorage, STORAGE_PREFIX);
}

export function createOpenAIBrowserOAuthClient(storage: AuthStorage) {
    return createBrowserAuthClient({
        provider: ProviderId.OpenAI,
        clientId: publicClientIds[ProviderId.OpenAI],
        storage
    });
}

export function loginWithOpenAIPopup(
    storage: AuthStorage,
    options: {signal: AbortSignal; timeoutMs: number}
) {
    return loginWithPopup(ProviderId.OpenAI, {
        clientId: publicClientIds[ProviderId.OpenAI],
        redirectUri: OPENAI_POPUP_REDIRECT_URI,
        storage,
        signal: options.signal,
        timeoutMs: options.timeoutMs
    });
}

export function toSafeDevicePrompt(device: DeviceCodeResponse): SafeDevicePrompt {
    return {
        userCode: device.userCode,
        verificationUri: device.verificationUri,
        ...(device.verificationUriComplete
            ? {verificationUriComplete: device.verificationUriComplete}
            : {}),
        expiresAt: device.expiresAt
    };
}

export function summarizeBrowserOAuthTokens(tokens: TokenSet): Omit<TokenSet, "raw"> {
    const {raw: _raw, ...safeTokens} = tokens;
    return safeTokens;
}

export {openai};
