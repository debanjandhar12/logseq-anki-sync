import {describe, expect, test} from "vitest";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";
import {getProviderConfigsSnapshot} from "../../../../../src/ui/pages/ProviderConfigModal/getProviderConfigsSnapshot";
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

describe("getProviderConfigsSnapshot", () => {
    test("ignores editor keys", () => {
        expect(getProviderConfigsSnapshot([config({editorKey: "first"})])).toBe(
            getProviderConfigsSnapshot([config({editorKey: "second"})])
        );
    });

    test.each([
        {name: "Primary "},
        {apiKey: "new-secret"},
        {models: [{id: "gpt-5", enabled: false}]}
    ])("detects draft field changes", (overrides) => {
        expect(getProviderConfigsSnapshot([config(overrides)])).not.toBe(
            getProviderConfigsSnapshot([config()])
        );
    });

    test("detects OAuth storage changes", () => {
        const first: EditableProviderConfig = {
            editorKey: "editor-1",
            uuid: "10000000-0000-4000-8000-000000000001",
            name: "Codex",
            type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
            baseUrl: "https://chatgpt.com/backend-api/codex",
            models: [{id: "codex-model", enabled: true}],
            oauthStorage: {accessToken: "first"}
        };
        const second: EditableProviderConfig = {
            ...first,
            oauthStorage: {accessToken: "second"}
        };

        expect(getProviderConfigsSnapshot([first])).not.toBe(getProviderConfigsSnapshot([second]));
    });
});
