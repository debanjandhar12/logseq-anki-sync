export enum ProviderTypeEnum {
    OPENAI = "openai",
    OPENAI_COMPATIBLE = "openai-compatible",
    GOOGLE = "google",
    CODEX_SUBSCRIPTION = "codex-subscription"
}

export interface ProviderModelConfig {
    id: string;
    enabled: boolean;
}

interface ProviderConfigBase {
    uuid: string;
    name: string;
    baseUrl: string;
    models: ProviderModelConfig[];
}

export type ApiKeyProviderConfig = ProviderConfigBase & {
    type: ProviderTypeEnum.OPENAI | ProviderTypeEnum.OPENAI_COMPATIBLE | ProviderTypeEnum.GOOGLE;
    apiKey: string;
};

export type OAuthProviderConfig = ProviderConfigBase & {
    type: ProviderTypeEnum.CODEX_SUBSCRIPTION;
    oauthStorage: Record<string, string>;
};

export type ProviderConfig = ApiKeyProviderConfig | OAuthProviderConfig;

export function isOAuthProviderConfig(config: ProviderConfig): config is OAuthProviderConfig {
    return config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION;
}

export enum WebToolsProviderEnum {
    DISABLED = "Disable Web Search",
    JINA = "Jina.ai",
    MODEL_NATIVE = "Model Native (OpenAI / Google / Codex)"
}

export type ReasoningEffort = "low" | "medium" | "high";
