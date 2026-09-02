import {beforeEach, describe, expect, test, vi} from "vitest";
import {ProviderConfigSettingOAuthStorage} from "../../../../../src/core/ai-sdk/oauth/ProviderConfigSettingOAuthStorage";
import {ProviderConfigRepository} from "../../../../../src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";

const PROVIDER_UUID = "10000000-0000-4000-8000-000000000001";

vi.mock("../../../../../src/core/ai-sdk/provider-config/ProviderConfigRepository", () => ({
    ProviderConfigRepository: {
        read: vi.fn(),
        updateOAuthStorage: vi.fn()
    }
}));

describe("ProviderConfigSettingOAuthStorage", () => {
    beforeEach(() => vi.clearAllMocks());

    test("reads keys and values from embedded OAuth storage", async () => {
        vi.mocked(ProviderConfigRepository.read).mockReturnValue([
            {
                uuid: PROVIDER_UUID,
                name: "Codex",
                type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                baseUrl: "https://chatgpt.com/backend-api/codex",
                oauthStorage: {accessToken: "access", refreshToken: "refresh"},
                models: [{id: "gpt-5", enabled: true}]
            }
        ]);
        const storage = new ProviderConfigSettingOAuthStorage(PROVIDER_UUID);

        await expect(storage.get("accessToken")).resolves.toBe("access");
        await expect(storage.get("missing")).resolves.toBeNull();
        await expect(storage.keys()).resolves.toEqual(["accessToken", "refreshToken"]);
    });

    test("returns empty reads when the UUID is unavailable or not OAuth", async () => {
        vi.mocked(ProviderConfigRepository.read).mockReturnValue([
            {
                uuid: PROVIDER_UUID,
                name: "OpenAI",
                type: ProviderTypeEnum.OPENAI,
                baseUrl: "https://api.openai.com/v1",
                apiKey: "secret",
                models: [{id: "gpt-5", enabled: true}]
            }
        ]);
        const storage = new ProviderConfigSettingOAuthStorage(PROVIDER_UUID);

        await expect(storage.get("accessToken")).resolves.toBeNull();
        await expect(storage.keys()).resolves.toEqual([]);
    });

    test("delegates set and delete as repository mutations", async () => {
        vi.mocked(ProviderConfigRepository.read).mockReturnValue([
            {
                uuid: PROVIDER_UUID,
                name: "Codex",
                type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                baseUrl: "https://chatgpt.com/backend-api/codex",
                oauthStorage: {accessToken: "access", refreshToken: "refresh"},
                models: []
            }
        ]);
        let persisted: Record<string, string> = {
            accessToken: "access",
            refreshToken: "refresh"
        };
        vi.mocked(ProviderConfigRepository.updateOAuthStorage).mockImplementation(
            async (_uuid, update) => {
                persisted = update(persisted);
            }
        );
        const storage = new ProviderConfigSettingOAuthStorage(PROVIDER_UUID);

        await storage.get("accessToken");
        await storage.set("accessToken", "new-access");
        expect(persisted).toEqual({
            refreshToken: "refresh",
            accessToken: "new-access"
        });

        await storage.get("refreshToken");
        await storage.delete("refreshToken");
        expect(persisted).toEqual({accessToken: "new-access"});
        expect(ProviderConfigRepository.updateOAuthStorage).toHaveBeenNthCalledWith(
            1,
            PROVIDER_UUID,
            expect.any(Function)
        );
    });

    test("rejects a stale write after credentials changed", async () => {
        vi.mocked(ProviderConfigRepository.read).mockReturnValue([
            {
                uuid: PROVIDER_UUID,
                name: "Codex",
                type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
                baseUrl: "https://chatgpt.com/backend-api/codex",
                oauthStorage: {token: "old"},
                models: []
            }
        ]);
        vi.mocked(ProviderConfigRepository.updateOAuthStorage).mockImplementation(
            async (_uuid, update) => void update({token: "newer"})
        );
        const onConflict = vi.fn();
        const storage = new ProviderConfigSettingOAuthStorage(PROVIDER_UUID, onConflict);
        await storage.get("token");

        await expect(storage.set("token", "stale-refresh")).rejects.toThrow(
            "OAuth credentials changed during update"
        );
        expect(onConflict).toHaveBeenCalledOnce();
    });
});
