import type {OpenAIOAuthTokens, TokenStore} from "openai-oauth-ai-provider/core";

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
        this.tokens = tokens;
        this.onSave?.(tokens);
    }
}
