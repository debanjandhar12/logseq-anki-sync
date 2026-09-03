import {describe, expect, test} from "vitest";
import {validateProviderConfigBaseUrl} from "../../../../../../src/ui/pages/ProviderConfigModal/validation/validateProviderConfigBaseUrl";

describe("validateProviderConfigBaseUrl", () => {
    test("returns the normalized URL", () => {
        expect(validateProviderConfigBaseUrl(" https://api.example.com/v1/// ")).toEqual({
            valid: true,
            normalizedBaseUrl: "https://api.example.com/v1"
        });
    });

    test.each([
        "not-a-url",
        "ftp://api.example.com/v1",
        "https://user:password@api.example.com/v1",
        "https://api.example.com/v1?version=1",
        "https://api.example.com/v1#models"
    ])("rejects invalid provider URL %s", (baseUrl) => {
        expect(validateProviderConfigBaseUrl(baseUrl)).toEqual({
            valid: false,
            reason: "invalid-base-url"
        });
    });
});
