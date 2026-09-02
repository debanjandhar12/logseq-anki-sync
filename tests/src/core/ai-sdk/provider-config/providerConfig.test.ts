import {afterEach, describe, expect, test, vi} from "vitest";
import {fetchProviderModels} from "../../../../../src/core/ai-sdk/provider-config/fetchProviderModels";
import {mergeProviderModels} from "../../../../../src/core/ai-sdk/provider-config/mergeProviderModels";
import {
    decodeProviderConfigs,
    encodeProviderConfigs
} from "../../../../../src/core/ai-sdk/provider-config/providerConfigCodec";
import {resolveLLMSelection} from "../../../../../src/core/ai-sdk/provider-config/resolveLLMSelection";
import {
    formatSelectedModelId,
    parseSelectedModelId,
    reconcileSelectedModelId
} from "../../../../../src/core/ai-sdk/provider-config/selectedModelId";
import {
    type ApiKeyProviderConfig,
    type OAuthProviderConfig,
    ProviderTypeEnum
} from "../../../../../src/core/ai-sdk/types";

const PRIMARY_UUID = "10000000-0000-4000-8000-000000000001";
const RENAMED_UUID = "10000000-0000-4000-8000-000000000002";

const config = (overrides: Partial<ApiKeyProviderConfig> = {}): ApiKeyProviderConfig => ({
    uuid: PRIMARY_UUID,
    name: "Primary",
    type: ProviderTypeEnum.OPENAI,
    baseUrl: "https://api.example.test/v1/",
    apiKey: "secret-key",
    models: [{id: "model////version", enabled: true}],
    ...overrides
});

const oauthConfig = (overrides: Partial<OAuthProviderConfig> = {}): OAuthProviderConfig => ({
    uuid: PRIMARY_UUID,
    name: "Codex",
    type: ProviderTypeEnum.CODEX_SUBSCRIPTION,
    baseUrl: "https://chatgpt.com/backend-api/codex",
    oauthStorage: {},
    models: [],
    ...overrides
});

afterEach(() => vi.unstubAllGlobals());

describe("provider configuration codec", () => {
    test("requires signed-in Codex storage and validates the fixed URL", () => {
        expect(() => encodeProviderConfigs([oauthConfig()])).toThrow();
        expect(() =>
            encodeProviderConfigs([
                oauthConfig({
                    oauthStorage: {accessToken: "access", refreshToken: "refresh"},
                    models: [{id: "gpt-5", enabled: true}]
                })
            ])
        ).not.toThrow();
        expect(() =>
            encodeProviderConfigs([
                oauthConfig({
                    oauthStorage: {accessToken: "access", refreshToken: "refresh"},
                    models: []
                })
            ])
        ).toThrow();
        expect(() =>
            encodeProviderConfigs([oauthConfig({baseUrl: "https://example.test"})])
        ).toThrow();
    });

    test("round trips Unicode ProviderConfig arrays directly", () => {
        const configs = [config({name: "日本", models: [{id: "modèle", enabled: true}]})];
        const encoded = encodeProviderConfigs(configs);
        const decodedJson = new TextDecoder().decode(
            Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
        );
        expect(decodeProviderConfigs(encoded)).toEqual(configs);
        expect(JSON.parse(decodedJson)).toEqual(configs);
    });

    test.each([
        "not base64",
        btoa("{}"),
        btoa(JSON.stringify([{apiKey: "private"}]))
    ])("rejects malformed storage without exposing its contents", (encoded) => {
        expect(() => decodeProviderConfigs(encoded)).toThrow(
            "Stored provider configurations are invalid"
        );
        try {
            decodeProviderConfigs(encoded);
        } catch (error) {
            expect(String(error)).not.toContain("private");
        }
    });

    test("rejects semantically invalid configurations", () => {
        const invalidConfigs = [
            config({models: [{id: "", enabled: true}]}),
            config({baseUrl: "https://api.example.test/v1?key=value"}),
            config({models: [{id: "model", enabled: false}]}),
            config({
                models: [
                    {id: "duplicate", enabled: true},
                    {id: "duplicate", enabled: false}
                ]
            })
        ];

        for (const invalidConfig of invalidConfigs) {
            expect(() => decodeProviderConfigs(btoa(JSON.stringify([invalidConfig])))).toThrow(
                "Stored provider configurations are invalid"
            );
        }
    });
});

describe("selected model identity and resolution", () => {
    test("splits only the first delimiter", () => {
        expect(
            parseSelectedModelId(formatSelectedModelId(PRIMARY_UUID, "model////version"))
        ).toEqual({providerUuid: PRIMARY_UUID, modelId: "model////version"});
    });

    test("rejects reserved provider UUIDs and malformed selections", () => {
        expect(() => formatSelectedModelId("bad////uuid", "model")).toThrow();
        expect(() => parseSelectedModelId("legacy-model-id")).toThrow();
    });

    test("requires the configured enabled model, key, and URL", () => {
        expect(resolveLLMSelection(`${PRIMARY_UUID}////model////version`, [config()])).toEqual({
            config: config(),
            rawModelId: "model////version"
        });
        expect(() =>
            resolveLLMSelection(`${PRIMARY_UUID}////disabled`, [
                config({models: [{id: "disabled", enabled: false}]})
            ])
        ).toThrow("not enabled");
        expect(() =>
            resolveLLMSelection(`${PRIMARY_UUID}////model////version`, [config({apiKey: ""})])
        ).toThrow("API key");
    });

    test("keeps valid UUID selections and deterministically falls back", () => {
        const renamed = config({
            uuid: RENAMED_UUID,
            name: "Renamed",
            models: [{id: "model", enabled: true}]
        });
        expect(reconcileSelectedModelId(`${RENAMED_UUID}////model`, [renamed])).toBe(
            `${RENAMED_UUID}////model`
        );
        expect(reconcileSelectedModelId(`${PRIMARY_UUID}////model`, [renamed])).toBe(
            `${RENAMED_UUID}////model`
        );
        expect(reconcileSelectedModelId(undefined, [])).toBe("");
    });
});

describe("provider model discovery and merge", () => {
    test("uses OpenAI auth, normalizes slashes, and deduplicates", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({data: [{id: " a "}, {id: "a"}, {id: "b"}]}), {
                status: 200
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchProviderModels(config())).resolves.toEqual(["a", "b"]);
        expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/models", {
            method: "GET",
            headers: {Authorization: "Bearer secret-key"}
        });
    });

    test("paginates Gemini and keeps generateContent models only", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        models: [
                            {
                                name: "models/gemini-a",
                                supportedGenerationMethods: ["generateContent"]
                            },
                            {name: "models/embed", supportedGenerationMethods: ["embedContent"]}
                        ],
                        nextPageToken: "next"
                    })
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        models: [
                            {
                                name: "models/gemini-b",
                                supportedGenerationMethods: ["generateContent"]
                            }
                        ]
                    })
                )
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            fetchProviderModels(
                config({type: ProviderTypeEnum.GOOGLE, baseUrl: "https://google.test/v1beta"})
            )
        ).resolves.toEqual(["gemini-a", "gemini-b"]);
        expect(fetchMock.mock.calls[1][0]).toBe("https://google.test/v1beta/models?pageToken=next");
        expect(fetchMock.mock.calls[0][1].headers).toEqual({"x-goog-api-key": "secret-key"});
    });

    test("merge preserves rows, order, and enabled states", () => {
        expect(
            mergeProviderModels(
                [
                    {id: "manual", enabled: false},
                    {id: "existing", enabled: true}
                ],
                ["existing", "new", "new"]
            )
        ).toEqual([
            {id: "manual", enabled: false},
            {id: "existing", enabled: true},
            {id: "new", enabled: false}
        ]);
    });
});
