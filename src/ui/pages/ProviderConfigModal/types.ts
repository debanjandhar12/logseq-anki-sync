import type {ProviderConfig} from "src/core/ai-sdk/types";

export interface EditableProviderConfig extends ProviderConfig {
    editorKey: string;
    originalId?: string;
}

export type ProviderConfigErrorField = "id" | "type" | "baseUrl" | "apiKey" | "models";

export interface ProviderConfigValidationIssue {
    editorKey: string;
    field: ProviderConfigErrorField;
    message: string;
    modelIndex?: number;
}
