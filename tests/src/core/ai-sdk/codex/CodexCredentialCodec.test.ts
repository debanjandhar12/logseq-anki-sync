import {describe, expect, test} from "vitest";
import {
    decodeCodexCredentials,
    encodeCodexCredentials,
    isValidCodexCredentials
} from "../../../../../src/core/ai-sdk/codex/CodexCredentialCodec";

const tokens = {
    accessToken: "access-token",
    idToken: "id-token",
    refreshToken: "refresh-token",
    updatedAt: 1_788_084_576_261,
    accountId: "account",
    planType: "plus",
    isFedRamp: false
};

describe("CodexCredentialCodec", () => {
    test("round trips the complete versioned token envelope", () => {
        const encoded = encodeCodexCredentials(tokens);
        expect(decodeCodexCredentials(encoded)).toEqual(tokens);
        expect(isValidCodexCredentials(encoded)).toBe(true);
        expect(JSON.parse(atob(encoded))).toEqual({
            version: 1,
            provider: "openai-oauth-ai-provider",
            tokens
        });
    });

    test.each([
        "",
        "not base64",
        btoa(JSON.stringify({version: 2, provider: "openai-oauth-ai-provider", tokens})),
        btoa(JSON.stringify({version: 1, provider: "other", tokens})),
        btoa(
            JSON.stringify({
                version: 1,
                provider: "openai-oauth-ai-provider",
                tokens: {...tokens, refreshToken: ""}
            })
        )
    ])("rejects invalid credentials without exposing their contents", (encoded) => {
        expect(() => decodeCodexCredentials(encoded)).toThrow(
            "Codex Subscription credentials are invalid"
        );
        expect(isValidCodexCredentials(encoded)).toBe(false);
        try {
            decodeCodexCredentials(encoded);
        } catch (error) {
            expect(String(error)).not.toContain("access-token");
            expect(String(error)).not.toContain("refresh-token");
        }
    });
});
