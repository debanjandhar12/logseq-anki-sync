import {type AuthClient, createAuthenticatedFetch} from "@ai-oauth-sdk/browser";
import {createOpenAI} from "@ai-sdk/openai";
import {streamText} from "ai";
import {createLLMModel} from "../getLLMModel";
import {OAuthClientCache} from "../oauth/OAuthClientCache";
import {type ProviderConfig, ProviderTypeEnum} from "../types";
import {validateProviderConnection} from "./validateProviderConfig";

export async function testProviderConfig(
    config: ProviderConfig,
    oauthClient?: AuthClient
): Promise<void> {
    validateProviderConnection(config);
    const model = config.models.find((candidate) => candidate.enabled && candidate.id.trim());
    if (!model) throw new Error("At least one enabled model is required");

    const controller = new AbortController();
    const timeoutMs = config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION ? 60_000 : 15_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const languageModel = (() => {
            if (config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
                // Modal tests must use the unsaved, memory-backed OAuth client. createLLMModel
                // resolves the persisted client and could otherwise test stale credentials.
                const client = oauthClient ?? OAuthClientCache.get(config);
                return createOpenAI({
                    apiKey: "unused",
                    baseURL: client.provider.apiBaseUrl,
                    fetch: createAuthenticatedFetch(client)
                }).responses(model.id.trim());
            }
            return createLLMModel({config, rawModelId: model.id.trim()});
        })();
        const result = streamText({
            model: languageModel,
            prompt: "Reply with OK.",
            maxOutputTokens: 8,
            abortSignal: controller.signal
        });
        let finished = false;
        for await (const part of result.stream) {
            if (part.type === "error") throw part.error;
            if (part.type === "abort") throw new Error("Provider connection test aborted");
            if (part.type === "finish") finished = true;
        }
        if (!finished) throw new Error("Provider connection test ended before completion");
    } catch {
        if (controller.signal.aborted) throw new Error("Provider connection test timed out");
        throw new Error("Provider connection test failed");
    } finally {
        clearTimeout(timeout);
    }
}
