import {describe, expect, test} from "vitest";
import {DEFAULT_CODEX_BASE_URL} from "../../../../../src/core/ai-sdk/provider-config/constants";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";
import {toPersistedProviderConfigs} from "../../../../../src/ui/pages/ProviderConfigModal/toPersistedProviderConfigs";
import type {EditableProviderConfig} from "../../../../../src/ui/pages/ProviderConfigModal/types";

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

describe("toPersistedProviderConfigs", () => {
    test("removes editor state and normalizes persisted values", () => {
        expect(
            toPersistedProviderConfigs([
                config({
                    editorKey: "temporary-editor-key",
                    name: " Primary ",
                    apiKey: " secret ",
                    baseUrl: "https://api.openai.com/v1/// ",
                    models: [{id: " gpt-5 ", enabled: true}]
                })
            ])
        ).toEqual([
            {
                uuid: "10000000-0000-4000-8000-000000000001",
                name: "Primary",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://api.openai.com/v1",
                apiKey: "secret",
                models: [{id: "gpt-5", enabled: true}]
            }
        ]);
    });

    test("preserves OAuth storage without API-key fields", () => {
        const oauthStorage = {accessToken: "access", refreshToken: "refresh"};
        const [persisted] = toPersistedProviderConfigs([
            config({
                type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                baseUrl: DEFAULT_CODEX_BASE_URL,
                oauthStorage,
                models: [{id: " codex-model ", enabled: true}]
            })
        ]);

        expect(persisted).toEqual({
            uuid: "10000000-0000-4000-8000-000000000001",
            name: "Primary",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: DEFAULT_CODEX_BASE_URL,
            oauthStorage,
            models: [{id: "codex-model", enabled: true}]
        });
    });

    test("throws when called with an invalid base URL", () => {
        expect(() => toPersistedProviderConfigs([config({baseUrl: "invalid"})])).toThrow(
            "Provider Base URL is invalid"
        );
    });
});
