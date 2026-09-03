import {describe, expect, test} from "vitest";
import {ProviderTypeEnum} from "../../../../../../src/core/ai-sdk/types";
import type {EditableProviderConfig} from "../../../../../../src/ui/pages/ProviderConfigModal/types";
import {validateProviderConfigEnabledModel} from "../../../../../../src/ui/pages/ProviderConfigModal/validation/validateProviderConfigEnabledModel";

function config(models: EditableProviderConfig["models"]): EditableProviderConfig {
    return {
        editorKey: "editor-1",
        uuid: "10000000-0000-4000-8000-000000000001",
        name: "Primary",
        type: ProviderTypeEnum.OPENAI,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "secret",
        models
    };
}

describe("validateProviderConfigEnabledModel", () => {
    test.each([
        [[]],
        [[{id: "gpt-5", enabled: false}]],
        [[{id: "  ", enabled: true}]]
    ])("requires an enabled nonblank model", (models) => {
        expect(validateProviderConfigEnabledModel(config(models))).toEqual({
            valid: false,
            reason: "enabled-model-required"
        });
    });

    test("accepts an enabled nonblank model", () => {
        expect(
            validateProviderConfigEnabledModel(config([{id: " gpt-5 ", enabled: true}]))
        ).toEqual({valid: true});
    });
});
