import {describe, expect, test, vi} from "vitest";
import {DEFAULT_CODEX_BASE_URL} from "../../../../../../src/core/ai-sdk/provider-config/constants";
import {ProviderTypeEnum} from "../../../../../../src/core/ai-sdk/types";
import type {EditableProviderConfig} from "../../../../../../src/ui/pages/ProviderConfigModal/types";
import {validateProviderConfigAuthentication} from "../../../../../../src/ui/pages/ProviderConfigModal/validation/validateProviderConfigAuthentication";

function apiKeyConfig(apiKey: string): EditableProviderConfig {
    return {
        editorKey: "editor-1",
        uuid: "10000000-0000-4000-8000-000000000001",
        name: "Primary",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey,
        models: []
    };
}

function oauthConfig(): EditableProviderConfig {
    return {
        editorKey: "editor-2",
        uuid: "10000000-0000-4000-8000-000000000002",
        name: "Codex",
        type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
        baseUrl: DEFAULT_CODEX_BASE_URL,
        oauthStorage: {},
        models: []
    };
}

describe("validateProviderConfigAuthentication", () => {
    test("requires a nonblank API key", () => {
        expect(validateProviderConfigAuthentication(apiKeyConfig("  "), () => false)).toEqual({
            valid: false,
            reason: "api-key-required"
        });
        expect(validateProviderConfigAuthentication(apiKeyConfig(" secret "), () => false)).toEqual(
            {valid: true}
        );
    });

    test("uses the OAuth sign-in callback for the same config", () => {
        const config = oauthConfig();
        const isOAuthSignedIn = vi.fn((candidate: EditableProviderConfig) => candidate === config);

        expect(validateProviderConfigAuthentication(config, isOAuthSignedIn)).toEqual({
            valid: true
        });
        expect(isOAuthSignedIn).toHaveBeenCalledWith(config);
    });

    test("reports a missing OAuth sign-in", () => {
        expect(validateProviderConfigAuthentication(oauthConfig(), () => false)).toEqual({
            valid: false,
            reason: "oauth-sign-in-required"
        });
    });
});
