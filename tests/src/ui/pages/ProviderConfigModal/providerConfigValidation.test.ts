import {describe, expect, test} from "vitest";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";
import {
    toPersistedProviderConfigs,
    validateProviderConfigs
} from "../../../../../src/ui/pages/ProviderConfigModal/providerConfigValidation";
import type {EditableProviderConfig} from "../../../../../src/ui/pages/ProviderConfigModal/types";

function config(overrides: Partial<EditableProviderConfig> = {}): EditableProviderConfig {
    return {
        editorKey: "editor-1",
        originalId: "primary",
        id: "primary",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "secret",
        models: [{id: "gpt-5", enabled: true}],
        ...overrides
    };
}

describe("provider configuration validation", () => {
    test("accepts an empty configuration list", () => {
        expect(validateProviderConfigs([])).toEqual([]);
    });

    test("rejects duplicate, uppercase, and delimiter-containing IDs", () => {
        const issues = validateProviderConfigs([
            config({editorKey: "uppercase", id: "Primary"}),
            config({editorKey: "duplicate", id: "primary"}),
            config({editorKey: "delimiter", id: "bad////id"})
        ]);

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({editorKey: "uppercase", field: "id"}),
                expect.objectContaining({editorKey: "duplicate", field: "id"}),
                expect.objectContaining({editorKey: "delimiter", field: "id"})
            ])
        );
    });

    test("rejects missing credentials, invalid URLs, duplicate models, and no enabled model", () => {
        const issues = validateProviderConfigs([
            config({
                apiKey: " ",
                baseUrl: "not-a-url",
                models: [
                    {id: "same", enabled: false},
                    {id: "same", enabled: false}
                ]
            })
        ]);

        expect(issues.map((issue) => issue.field)).toEqual(
            expect.arrayContaining(["baseUrl", "apiKey", "models"])
        );
        expect(issues.filter((issue) => issue.modelIndex != null)).toHaveLength(2);
        expect(issues).toContainEqual(
            expect.objectContaining({field: "models", message: "Enable at least one model."})
        );
    });

    test("normalizes persisted IDs, URLs, and model IDs", () => {
        expect(
            toPersistedProviderConfigs([
                config({
                    id: "primary ",
                    baseUrl: "https://api.openai.com/v1/ ",
                    models: [{id: " gpt-5 ", enabled: true}]
                })
            ])
        ).toEqual([
            {
                id: "primary",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://api.openai.com/v1",
                apiKey: "secret",
                models: [{id: "gpt-5", enabled: true}]
            }
        ]);
    });
});
