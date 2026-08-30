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
import {type ProviderConfig, ProviderTypeEnum} from "../../../../../src/core/ai-sdk/types";

const config = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
    id: "primary",
    type: ProviderTypeEnum.OPENAI,
    baseUrl: "https://api.example.test/v1/",
    apiKey: "secret-key",
    models: [{id: "model////version", enabled: true}],
    ...overrides
});

afterEach(() => vi.unstubAllGlobals());

describe("provider configuration codec", () => {
    test("round trips Unicode ProviderConfig arrays directly", () => {
        const configs = [config({id: "日本", models: [{id: "modèle", enabled: true}]})];
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
        expect(parseSelectedModelId(formatSelectedModelId("primary", "model////version"))).toEqual({
            configId: "primary",
            modelId: "model////version"
        });
    });

    test("rejects reserved configuration IDs and malformed selections", () => {
        expect(() => formatSelectedModelId("bad////id", "model")).toThrow();
        expect(() => parseSelectedModelId("legacy-model-id")).toThrow();
    });

    test("requires the configured enabled model, key, and URL", () => {
        expect(resolveLLMSelection("primary////model////version", [config()])).toEqual({
            config: config(),
            rawModelId: "model////version"
        });
        expect(() =>
            resolveLLMSelection("primary////disabled", [
                config({models: [{id: "disabled", enabled: false}]})
            ])
        ).toThrow("not enabled");
        expect(() =>
            resolveLLMSelection("primary////model////version", [config({apiKey: ""})])
        ).toThrow("API key");
    });

    test("reconciles renames and deterministically falls back", () => {
        const renamed = config({id: "renamed", models: [{id: "model", enabled: true}]});
        expect(
            reconcileSelectedModelId("old////model", [renamed], new Map([["old", "renamed"]]))
        ).toBe("renamed////model");
        expect(reconcileSelectedModelId("missing////model", [renamed])).toBe("renamed////model");
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
            {id: "new", enabled: true}
        ]);
    });
});
