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

const FILE_STORE_ERROR =
    "The OpenAI OAuth file token store is unavailable in the browser runtime";

export function defaultTokenFilePath(): never {
    throw new Error(FILE_STORE_ERROR);
}

export class FileTokenStore implements TokenStore {
    constructor(_path?: string) {
        throw new Error(FILE_STORE_ERROR);
    }

    async clear(): Promise<void> {
        throw new Error(FILE_STORE_ERROR);
    }

    async load(): Promise<undefined> {
        throw new Error(FILE_STORE_ERROR);
    }

    async save(_tokens: OpenAIOAuthTokens): Promise<void> {
        throw new Error(FILE_STORE_ERROR);
    }
}

export class MemoryTokenStore implements TokenStore {
    constructor(private tokens?: OpenAIOAuthTokens) {}

    async clear(): Promise<void> {
        this.tokens = undefined;
    }

    async load(): Promise<OpenAIOAuthTokens | undefined> {
        return this.tokens;
    }

    async save(tokens: OpenAIOAuthTokens): Promise<void> {
        this.tokens = tokens;
    }
}
