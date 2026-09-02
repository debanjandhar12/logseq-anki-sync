import {beforeEach, describe, expect, test, vi} from "vitest";
import {createCodexOAuthClient} from "../../../../../src/core/ai-sdk/oauth/createCodexOAuthClient";
import {OAuthClientCache} from "../../../../../src/core/ai-sdk/oauth/OAuthClientCache";
import {type OAuthProviderConfig, ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";

const mocks = vi.hoisted(() => ({createBrowserAuthClient: vi.fn()}));

vi.mock("@ai-oauth-sdk/browser", () => ({
    createBrowserAuthClient: mocks.createBrowserAuthClient,
    ProviderId: {OpenAI: "openai"},
    publicClientIds: {openai: "codex-client"}
}));

function config(uuid: string): OAuthProviderConfig {
    return {
        uuid,
        name: "Codex",
        type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
        baseUrl: "https://chatgpt.com/backend-api/codex",
        oauthStorage: {},
        models: []
    };
}

describe("OAuthClientCache", () => {
    beforeEach(() => {
        OAuthClientCache.clear();
        mocks.createBrowserAuthClient.mockReset();
        mocks.createBrowserAuthClient.mockImplementation((options) => ({options}));
    });

    test("reuses one client per provider UUID", () => {
        const provider = config("10000000-0000-4000-8000-000000000001");

        expect(OAuthClientCache.get(provider)).toBe(
            OAuthClientCache.get({...provider, name: "Renamed"})
        );
        expect(mocks.createBrowserAuthClient).toHaveBeenCalledOnce();
    });

    test("isolates UUIDs and recreates an invalidated client", () => {
        const first = config("10000000-0000-4000-8000-000000000001");
        const second = config("10000000-0000-4000-8000-000000000002");
        const original = OAuthClientCache.get(first);

        expect(OAuthClientCache.get(second)).not.toBe(original);
        OAuthClientCache.invalidate(first.uuid);
        expect(OAuthClientCache.get(first)).not.toBe(original);
        expect(mocks.createBrowserAuthClient).toHaveBeenCalledTimes(3);
    });

    test("uses the provider UUID as the SDK account key", () => {
        const provider = config("10000000-0000-4000-8000-000000000001");
        const storage = {get: vi.fn(), set: vi.fn(), delete: vi.fn()};

        createCodexOAuthClient(provider, storage);

        expect(mocks.createBrowserAuthClient).toHaveBeenLastCalledWith(
            expect.objectContaining({
                provider: "openai",
                clientId: "codex-client",
                accountKey: provider.uuid,
                storage
            })
        );
    });
});
