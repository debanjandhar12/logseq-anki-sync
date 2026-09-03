import {describe, expect, test} from "vitest";
import {DEFAULT_CODEX_BASE_URL} from "../../../../../../src/core/ai-sdk/provider-config/constants";
import {ProviderTypeEnum} from "../../../../../../src/core/ai-sdk/types";
import type {EditableProviderConfig} from "../../../../../../src/ui/pages/ProviderConfigModal/types";
import {validateProviderConfigs} from "../../../../../../src/ui/pages/ProviderConfigModal/validation/validateProviderConfigs";

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

describe("validateProviderConfigs", () => {
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

    test("returns field and model issues in stable order", () => {
        const issues = validateProviderConfigs(
            [
                config({
                    editorKey: "invalid",
                    name: " ",
                    type: "unsupported" as ProviderTypeEnum,
                    apiKey: " ",
                    baseUrl: "not-a-url",
                    models: [
                        {id: "same", enabled: false},
                        {id: "same", enabled: false},
                        {id: "", enabled: false}
                    ]
                })
            ],
            () => false
        );

        expect(issues.map((issue) => issue.field)).toEqual([
            "name",
            "type",
            "baseUrl",
            "apiKey",
            "models",
            "models",
            "models",
            "models"
        ]);
        expect(issues.filter((issue) => issue.modelIndex != null)).toEqual([
            expect.objectContaining({editorKey: "invalid", modelIndex: 0}),
            expect.objectContaining({editorKey: "invalid", modelIndex: 1}),
            expect.objectContaining({editorKey: "invalid", modelIndex: 2})
        ]);
    });

    test.each([
        "ftp://api.example.com/v1",
        "https://user:password@api.example.com/v1",
        "https://api.example.com/v1?version=1",
        "https://api.example.com/v1#models"
    ])("rejects invalid base URL %s", (baseUrl) => {
        expect(validateProviderConfigs([config({baseUrl})], () => false)).toContainEqual(
            expect.objectContaining({field: "baseUrl"})
        );
    });

    test("accepts and normalizes URL whitespace and trailing slashes", () => {
        expect(
            validateProviderConfigs(
                [config({baseUrl: " https://api.openai.com/v1/// "})],
                () => false
            )
        ).toEqual([]);
    });

    test("requires Codex sign-in, fixed URL, and an enabled model", () => {
        const codex = config({
            name: "Codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: "https://api.example.com/v1",
            oauthStorage: {},
            models: []
        });

        expect(validateProviderConfigs([codex], () => false)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({field: "baseUrl"}),
                expect.objectContaining({field: "authentication"}),
                expect.objectContaining({field: "models"})
            ])
        );
    });

    test("accepts a signed-in Codex configuration", () => {
        const codex = config({
            name: "Codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: DEFAULT_CODEX_BASE_URL,
            oauthStorage: {},
            models: [{id: "codex-model", enabled: true}]
        });

        expect(validateProviderConfigs([codex], () => true)).toEqual([]);
    });
});
