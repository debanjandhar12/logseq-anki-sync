import type {ProviderConfigSaveDraft} from "src/core/ai-sdk/provider-config/ProviderConfigRepository";
import type {ProviderConfig} from "src/core/ai-sdk/types";

export type EditableProviderConfig = ProviderConfig & {editorKey: string};

export type ProviderConfigErrorField =
    | "name"
    | "type"
    | "baseUrl"
    | "apiKey"
    | "authentication"
    | "models";

export interface ProviderConfigValidationIssue {
    editorKey: string;
    field: ProviderConfigErrorField;
    message: string;
    modelIndex?: number;
}

export type OAuthSignInState =
    | {status: "idle"}
    | {status: "starting"}
    | {status: "waiting"; userCode: string; verificationUrl: string}
    | {status: "logging-out"}
    | {status: "error"; message: string};

export type OAuthSaveDraft = Pick<ProviderConfigSaveDraft, "oauthStorageMutation">;
