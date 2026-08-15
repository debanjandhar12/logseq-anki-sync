export enum ProviderEnum {
    OPENAI = "OpenAI",
    OPENAI_COMPATIBLE = "OpenAI Compatible",
    GOOGLE = "Google Generative AI"
}

export enum WebToolsProviderEnum {
    DISABLED = "Disable Web Search",
    JINA = "Jina.ai",
    MODEL_NATIVE = "Model Native (OpenAI / Google)"
}

export type ReasoningEffort = "low" | "medium" | "high";

export const PROVIDER_SNAPSHOT_KEY: Record<string, string> = {
    [ProviderEnum.OPENAI]: "openai",
    [ProviderEnum.GOOGLE]: "google"
};
