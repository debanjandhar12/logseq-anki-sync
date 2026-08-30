import {createOpenAIOAuthProvider, type OpenAIOAuthProvider} from "openai-oauth-ai-provider/ai-sdk";
import {type Codex, codex} from "openai-oauth-ai-provider/codex";
import {OpenAIOAuth, type OpenAIOAuthTokens} from "openai-oauth-ai-provider/core";
import {DEFAULT_CODEX_BASE_URL} from "../provider-config/constants";
import {ProviderConfigRepository} from "../provider-config/ProviderConfigRepository";
import {validateCodexAuthentication} from "../provider-config/validateProviderConfig";
import type {ProviderConfig} from "../types";
import {decodeCodexCredentials, encodeCodexCredentials} from "./CodexCredentialCodec";
import {CodexProviderTokenStore} from "./CodexProviderTokenStore";
import {InMemoryCodexTokenStore} from "./InMemoryCodexTokenStore";

export interface CodexSession {
    auth: OpenAIOAuth;
    aiProvider: OpenAIOAuthProvider;
    codexClient: Codex;
}

const runtimeSessions = new Map<string, CodexSession>();

function createSession(
    tokenStore: InMemoryCodexTokenStore | CodexProviderTokenStore
): CodexSession {
    const fetchImplementation = globalThis.fetch.bind(globalThis);
    const auth = new OpenAIOAuth({tokenStore, fetch: fetchImplementation});
    return {
        auth,
        aiProvider: createOpenAIOAuthProvider({
            auth,
            baseURL: DEFAULT_CODEX_BASE_URL,
            fetch: fetchImplementation
        }),
        codexClient: codex({auth, baseURL: DEFAULT_CODEX_BASE_URL, fetch: fetchImplementation})
    };
}

export const CodexSessionManager = {
    getConfigSession(
        config: ProviderConfig,
        onDraftCredentialsUpdated?: (encodedCredentials: string) => void
    ): CodexSession {
        validateCodexAuthentication(config);
        const persisted = ProviderConfigRepository.read().find(
            (candidate) =>
                candidate.id === config.id &&
                candidate.type === config.type &&
                candidate.apiKey === config.apiKey
        );
        return persisted
            ? this.getRuntimeSession(config)
            : this.createDraftSession(config.apiKey, onDraftCredentialsUpdated);
    },

    getRuntimeSession(config: ProviderConfig): CodexSession {
        validateCodexAuthentication(config);
        const cacheKey = `${config.id}\u0000${config.apiKey}`;
        const cached = runtimeSessions.get(cacheKey);
        if (cached) return cached;
        for (const key of runtimeSessions.keys()) {
            if (key.startsWith(`${config.id}\u0000`)) runtimeSessions.delete(key);
        }
        const session = createSession(new CodexProviderTokenStore(config.id, config.apiKey));
        runtimeSessions.set(cacheKey, session);
        return session;
    },

    createDraftSession(
        encodedCredentials: string,
        onSave?: (encodedCredentials: string) => void
    ): CodexSession {
        if (!encodedCredentials) throw new Error("Sign in to Codex Subscription first");
        const tokens = decodeCodexCredentials(encodedCredentials);
        return this.createDeviceLoginSession(onSave, tokens);
    },

    createDeviceLoginSession(
        onSave?: (encodedCredentials: string) => void,
        tokens?: OpenAIOAuthTokens
    ): CodexSession {
        const store = new InMemoryCodexTokenStore(tokens, (savedTokens) => {
            onSave?.(encodeCodexCredentials(savedTokens));
        });
        return createSession(store);
    },

    clearRuntimeCache(): void {
        runtimeSessions.clear();
    }
};

ProviderConfigRepository.subscribeToCredentialUpdates(({providerId}) => {
    for (const key of runtimeSessions.keys()) {
        if (key.startsWith(`${providerId}\u0000`)) runtimeSessions.delete(key);
    }
});
