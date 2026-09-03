import {describe, expect, test} from "vitest";
import {DEFAULT_CODEX_BASE_URL} from "../../../../../../src/core/ai-sdk/provider-config/constants";
import {ProviderTypeEnum} from "../../../../../../src/core/ai-sdk/types";
import type {EditableProviderConfig} from "../../../../../../src/ui/pages/ProviderConfigModal/types";
import {getProviderConfigActionValidationMessage} from "../../../../../../src/ui/pages/ProviderConfigModal/validation/getProviderConfigActionValidationMessage";

function config(overrides: Partial<EditableProviderConfig> = {}): EditableProviderConfig {
    return {
        editorKey: "editor-1",
        uuid: "10000000-0000-4000-8000-000000000001",
        name: "Primary",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "secret",
        models: [{id: "gpt-5", enabled: true}],
        ...overrides
    } as EditableProviderConfig;
}

function validate(
    candidate: EditableProviderConfig,
    requireEnabledModel: boolean,
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean = () => false
) {
    return getProviderConfigActionValidationMessage(candidate, {
        requireEnabledModel,
        isOAuthSignedIn
    });
}

describe("getProviderConfigActionValidationMessage", () => {
    test("returns concise errors in prerequisite order", () => {
        expect(validate(config({baseUrl: "invalid", apiKey: "", models: []}), true)).toBe(
            "Enter a valid Base URL first."
        );
        expect(validate(config({apiKey: "", models: []}), true)).toBe("Enter an API key first.");
        expect(validate(config({models: []}), true)).toBe("Enable at least one model first.");
    });

    test("does not require a model when fetching models", () => {
        expect(validate(config({models: []}), false)).toBeNull();
    });

    test("requires OAuth sign-in instead of an API key", () => {
        const codex = config({
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: DEFAULT_CODEX_BASE_URL,
            oauthStorage: {},
            models: []
        });

        expect(validate(codex, false)).toBe("Sign in first.");
        expect(validate(codex, false, () => true)).toBeNull();
    });

    test.each([
        "https://api.example.com/v1?version=1",
        "https://api.example.com/v1#models"
    ])("rejects a URL that core validation cannot use: %s", (baseUrl) => {
        expect(validate(config({baseUrl}), false)).toBe("Enter a valid Base URL first.");
    });
});
