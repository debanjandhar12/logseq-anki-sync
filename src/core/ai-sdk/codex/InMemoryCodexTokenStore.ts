import type {OpenAIOAuthTokens, TokenStore} from "openai-oauth-ai-provider/core";
import {normalizeCodexTokens} from "./CodexCredentialCodec";

export class InMemoryCodexTokenStore implements TokenStore {
    private tokens: OpenAIOAuthTokens | undefined;

    constructor(
        tokens?: OpenAIOAuthTokens,
        private readonly onSave?: (tokens: OpenAIOAuthTokens) => void
    ) {
        this.tokens = tokens;
    }

    async clear(): Promise<void> {
        this.tokens = undefined;
    }

    async load(): Promise<OpenAIOAuthTokens | undefined> {
        return this.tokens;
    }

    async save(tokens: OpenAIOAuthTokens): Promise<void> {
        const normalized = normalizeCodexTokens(tokens);
        this.tokens = normalized;
        this.onSave?.(normalized);
    }
}
