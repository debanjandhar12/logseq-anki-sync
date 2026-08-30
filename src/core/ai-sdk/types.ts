export enum ProviderTypeEnum {
    OPENAI = "openai",
    OPENAI_COMPATIBLE = "openai-compatible",
    GOOGLE = "google"
}

export interface ProviderModelConfig {
    id: string;
    enabled: boolean;
}

export interface ProviderConfig {
    id: string;
    type: ProviderTypeEnum;
    baseUrl: string;
    apiKey: string;
    models: ProviderModelConfig[];
}

export enum WebToolsProviderEnum {
    DISABLED = "Disable Web Search",
    JINA = "Jina.ai",
    MODEL_NATIVE = "Model Native (OpenAI / Google)"
}

export type ReasoningEffort = "low" | "medium" | "high";
