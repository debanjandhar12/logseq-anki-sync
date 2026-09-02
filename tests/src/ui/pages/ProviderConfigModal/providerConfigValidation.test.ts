import {describe, expect, test} from "vitest";
import {DEFAULT_CODEX_BASE_URL} from "../../../../../src/core/ai-sdk/provider-config/constants";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";
import {
    toPersistedProviderConfigs,
    validateProviderConfigs
} from "../../../../../src/ui/pages/ProviderConfigModal/providerConfigValidation";
import type {EditableProviderConfig} from "../../../../../src/ui/pages/ProviderConfigModal/types";

const PRIMARY_UUID = "10000000-0000-4000-8000-000000000001";

function config(overrides: Partial<EditableProviderConfig> = {}): EditableProviderConfig {
    return {
        editorKey: "editor-1",
        uuid: PRIMARY_UUID,
        name: "Primary",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "secret",
        models: [{id: "gpt-5", enabled: true}],
        ...overrides
    } as EditableProviderConfig;
}

describe("provider configuration validation", () => {
    test("requires at least one provider configuration", () => {
        expect(validateProviderConfigs([], () => false)).toEqual([
            expect.objectContaining({message: "At least one provider configuration is required."})
        ]);
    });

    test("rejects duplicate and missing names", () => {
        const issues = validateProviderConfigs(
            [
                config({editorKey: "first", name: "Primary"}),
                config({editorKey: "duplicate", name: " primary "}),
                config({editorKey: "missing", name: " "})
            ],
            () => false
        );

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({editorKey: "first", field: "name"}),
                expect.objectContaining({editorKey: "duplicate", field: "name"}),
                expect.objectContaining({editorKey: "missing", field: "name"})
            ])
        );
    });

    test("rejects missing credentials, invalid URLs, duplicate models, and no enabled model", () => {
        const issues = validateProviderConfigs(
            [
                config({
                    apiKey: " ",
                    baseUrl: "not-a-url",
                    models: [
                        {id: "same", enabled: false},
                        {id: "same", enabled: false}
                    ]
                })
            ],
            () => false
        );

        expect(issues.map((issue) => issue.field)).toEqual(
            expect.arrayContaining(["baseUrl", "apiKey", "models"])
        );
        expect(issues.filter((issue) => issue.modelIndex != null)).toHaveLength(2);
        expect(issues).toContainEqual(
            expect.objectContaining({field: "models", message: "Enable at least one model."})
        );
    });

    test("normalizes persisted names, URLs, API keys, and model IDs", () => {
        expect(
            toPersistedProviderConfigs([
                config({
                    name: " Primary ",
                    apiKey: " secret ",
                    baseUrl: "https://api.openai.com/v1/ ",
                    models: [{id: " gpt-5 ", enabled: true}]
                })
            ])
        ).toEqual([
            {
                uuid: PRIMARY_UUID,
                name: "Primary",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://api.openai.com/v1",
                apiKey: "secret",
                models: [{id: "gpt-5", enabled: true}]
            }
        ]);
    });

    test("requires Codex sign-in and an enabled model", () => {
        const codex = config({
            name: "Codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: DEFAULT_CODEX_BASE_URL,
            oauthStorage: {},
            models: []
        });

        expect(validateProviderConfigs([codex], () => false)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({field: "authentication"}),
                expect.objectContaining({field: "models"})
            ])
        );
    });

    test("preserves embedded OAuth storage without API-key semantics", () => {
        const oauthStorage = {accessToken: "access", refreshToken: "refresh"};
        const [persisted] = toPersistedProviderConfigs([
            config({
                name: "Codex",
                type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                baseUrl: DEFAULT_CODEX_BASE_URL,
                oauthStorage,
                models: [{id: " codex-model ", enabled: true}]
            })
        ]);

        expect(persisted).toMatchObject({oauthStorage});
        expect(persisted.models).toEqual([{id: "codex-model", enabled: true}]);
        expect(validateProviderConfigs([{...persisted, editorKey: "codex"}], () => true)).toEqual(
            []
        );
    });
});
