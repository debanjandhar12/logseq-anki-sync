import {resolveBrowserFlow, type TokenSet} from "@ai-oauth-sdk/browser";
import {describe, expect, test} from "vitest";
import {
    createBrowserOAuthStorage,
    createMemoryOAuthStorage,
    createOpenAIBrowserOAuthClient,
    openai,
    summarizeBrowserOAuthTokens,
    toSafeDevicePrompt
} from "../../../../../src/ui/pages/ProviderConfigModal/aiOAuthSdkBrowserFlow";

const tokens: TokenSet = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    idToken: "id-token",
    tokenType: "Bearer",
    provider: "openai",
    raw: {
        access_token: "duplicate-access-token",
        refresh_token: "duplicate-refresh-token"
    }
};

describe("@ai-oauth-sdk/browser experiments", () => {
    test.each([
        [{protocol: "http:", hostname: "localhost", port: "5173"}],
        [{protocol: "https:", hostname: "plugin.example", port: ""}],
        [{protocol: "file:", hostname: "", port: ""}]
    ])("resolves OpenAI to device flow for the plugin origin %#", (origin) => {
        expect(resolveBrowserFlow(openai, origin)).toEqual(
            expect.objectContaining({
                flow: "device",
                devicePrerequisite: expect.any(String)
            })
        );
    });

    test("recognizes OpenAI's fixed loopback callback origin", () => {
        expect(
            resolveBrowserFlow(openai, {
                protocol: "http:",
                hostname: "localhost",
                port: "1455"
            })
        ).toEqual({
            flow: "popup",
            redirectUri: "http://localhost:1455/auth/callback"
        });
    });

    test("keeps device secrets out of the UI projection", () => {
        expect(
            toSafeDevicePrompt({
                deviceCode: "device-secret",
                codeVerifier: "pkce-secret",
                userCode: "ABCD-EFGH",
                verificationUri: "https://auth.openai.com/codex/device",
                verificationUriComplete: "https://auth.openai.com/codex/device?code=ABCD-EFGH",
                expiresAt: 1234,
                intervalMs: 5000
            })
        ).toEqual({
            userCode: "ABCD-EFGH",
            verificationUri: "https://auth.openai.com/codex/device",
            verificationUriComplete: "https://auth.openai.com/codex/device?code=ABCD-EFGH",
            expiresAt: 1234
        });
    });

    test("omits the duplicate raw token response from notifications", () => {
        expect(summarizeBrowserOAuthTokens(tokens)).toEqual({
            accessToken: "access-token",
            refreshToken: "refresh-token",
            idToken: "id-token",
            tokenType: "Bearer",
            provider: "openai"
        });
    });

    test("persists session credentials across clients", async () => {
        const memory = createMemoryOAuthStorage();
        const storage = createBrowserOAuthStorage("session", memory);
        const firstClient = createOpenAIBrowserOAuthClient(storage);
        const secondClient = createOpenAIBrowserOAuthClient(storage);

        await firstClient.setTokens(tokens);

        expect(await secondClient.getTokens()).toEqual(tokens);
        await secondClient.logout();
        expect(await createOpenAIBrowserOAuthClient(storage).getTokens()).toBeUndefined();
    });

    test("keeps separate memory storage instances isolated", async () => {
        const firstClient = createOpenAIBrowserOAuthClient(
            createBrowserOAuthStorage("memory", createMemoryOAuthStorage())
        );
        const secondClient = createOpenAIBrowserOAuthClient(
            createBrowserOAuthStorage("memory", createMemoryOAuthStorage())
        );

        await firstClient.setTokens(tokens);

        expect(await secondClient.getTokens()).toBeUndefined();
    });
});
