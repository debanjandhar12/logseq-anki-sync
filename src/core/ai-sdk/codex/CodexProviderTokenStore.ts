import AsyncLock from "async-lock";
import type {OpenAIOAuthTokens, TokenStore} from "openai-oauth-ai-provider/core";
import {ProviderConfigRepository} from "../provider-config/ProviderConfigRepository";
import {decodeCodexCredentials, normalizeCodexTokens} from "./CodexCredentialCodec";

export class CodexProviderTokenStore implements TokenStore {
    private readonly lock = new AsyncLock();

    constructor(
        private readonly providerId: string,
        private expectedCredentials: string
    ) {}

    async clear(): Promise<void> {
        throw new Error("Persistent Codex credentials can only be cleared from provider settings");
    }

    async load(): Promise<OpenAIOAuthTokens> {
        return decodeCodexCredentials(this.expectedCredentials);
    }

    async save(tokens: OpenAIOAuthTokens): Promise<void> {
        this.expectedCredentials = await ProviderConfigRepository.updateCodexCredentials(
            this.providerId,
            this.expectedCredentials,
            normalizeCodexTokens(tokens)
        );
    }

    async withLock<T>(operation: () => Promise<T>): Promise<T> {
        return this.lock.acquire("tokens", operation);
    }
}
