import {z} from "zod";
import {CodexSessionManager} from "../codex/CodexSessionManager";
import {type ProviderConfig, ProviderTypeEnum} from "../types";
import {validateProviderBaseUrl, validateProviderConnection} from "./validateProviderConfig";

const openAIModelsSchema = z.object({data: z.array(z.object({id: z.string()}))});
const googleModelsSchema = z.object({
    models: z
        .array(
            z.object({
                name: z.string(),
                supportedGenerationMethods: z.array(z.string()).optional()
            })
        )
        .default([]),
    nextPageToken: z.string().optional()
});

function uniqueModelIds(ids: string[]): string[] {
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function fetchJson(url: string, headers: HeadersInit): Promise<unknown> {
    const response = await fetch(url, {method: "GET", headers});
    if (!response.ok) {
        throw new Error(`Provider model request failed (${response.status})`);
    }
    try {
        return await response.json();
    } catch {
        throw new Error("Provider returned an invalid model response");
    }
}

export async function fetchProviderModels(
    config: ProviderConfig,
    onCodexCredentialsUpdated?: (encodedCredentials: string) => void
): Promise<string[]> {
    validateProviderConnection(config);
    const baseUrl = validateProviderBaseUrl(config.baseUrl);

    if (config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
        const models = await CodexSessionManager.getConfigSession(
            config,
            onCodexCredentialsUpdated
        ).codexClient.listCodexModels();
        return uniqueModelIds(models.map((model) => model.slug));
    }

    if (config.type !== ProviderTypeEnum.GOOGLE) {
        const payload = await fetchJson(`${baseUrl}/models`, {
            Authorization: `Bearer ${config.apiKey.trim()}`
        });
        const parsed = openAIModelsSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Provider returned an invalid model response");
        return uniqueModelIds(parsed.data.data.map((model) => model.id));
    }

    const modelIds: string[] = [];
    let pageToken: string | undefined;
    do {
        const url = new URL(`${baseUrl}/models`);
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const payload = await fetchJson(url.toString(), {"x-goog-api-key": config.apiKey.trim()});
        const parsed = googleModelsSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Provider returned an invalid model response");
        modelIds.push(
            ...parsed.data.models
                .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
                .map((model) => model.name.replace(/^models\//, ""))
        );
        pageToken = parsed.data.nextPageToken;
    } while (pageToken);

    return uniqueModelIds(modelIds);
}
