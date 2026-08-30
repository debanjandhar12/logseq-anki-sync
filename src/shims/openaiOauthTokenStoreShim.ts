/**
 * Browser-safe replacement for openai-oauth-ai-provider's `store.js`.
 *
 * The original module imports `node:fs/promises` to implement FileTokenStore,
 * which breaks the browser bundle. The plugin only uses MemoryTokenStore, so
 * FileTokenStore is replaced with a stub that throws if instantiated.
 */

export interface OpenAIOAuthTokens {
    readonly accessToken: string;
    readonly accountId?: string;
    readonly idToken: string;
    readonly isFedRamp?: boolean;
    readonly planType?: string;
    readonly refreshToken: string;
    readonly updatedAt: number;
}

export interface TokenStore {
    clear(): Promise<void>;
    load(): Promise<OpenAIOAuthTokens | undefined>;
    save(tokens: OpenAIOAuthTokens): Promise<void>;
    withLock?<T>(operation: () => Promise<T>): Promise<T>;
}

export function defaultTokenFilePath(): string {
    throw new Error("FileTokenStore is not available in the Logseq plugin runtime.");
}

export class FileTokenStore implements TokenStore {
    constructor(_path?: string) {
        throw new Error("FileTokenStore is not available in the Logseq plugin runtime.");
    }
    clear(): Promise<void> {
        return Promise.resolve();
    }
    load(): Promise<OpenAIOAuthTokens | undefined> {
        return Promise.resolve(undefined);
    }
    save(): Promise<void> {
        return Promise.resolve();
    }
    withLock<T>(operation: () => Promise<T>): Promise<T> {
        return operation();
    }
}

export class MemoryTokenStore implements TokenStore {
    private tokens: OpenAIOAuthTokens | undefined;

    constructor(tokens?: OpenAIOAuthTokens) {
        this.tokens = tokens;
    }

    clear(): Promise<void> {
        this.tokens = undefined;
        return Promise.resolve();
    }

    load(): Promise<OpenAIOAuthTokens | undefined> {
        return Promise.resolve(this.tokens);
    }

    save(tokens: OpenAIOAuthTokens): Promise<void> {
        this.tokens = tokens;
        return Promise.resolve();
    }
}
