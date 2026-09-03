import {createAuthenticatedFetch} from "@ai-oauth-sdk/browser";
import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import type {ToolSet} from "ai";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {OAuthClientCache} from "./oauth/OAuthClientCache";
import {readProviderConfigs} from "./provider-config/readProviderConfigs";
import {
    type ResolvedLLMSelection,
    resolveLLMSelection
} from "./provider-config/resolveLLMSelection";
import {validateProviderBaseUrl} from "./provider-config/validateProviderConfig";
import {ProviderTypeEnum} from "./types";

export function getLLMProviderTools(resolvedSelection?: ResolvedLLMSelection): ToolSet {
    const settings = LogseqSettingAccessor.getPluginSettings();

    const resolved =
        resolvedSelection ??
        resolveLLMSelection(settings.selectedModelId ?? "", readProviderConfigs());

    if (resolved.config.type === ProviderTypeEnum.OPENAI) {
        const openai = createOpenAI({
            apiKey: resolved.config.apiKey,
            baseURL: validateProviderBaseUrl(resolved.config.baseUrl)
        });
        return {
            web_search: openai.tools.webSearch({})
        };
    }

    if (resolved.config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
        const client = OAuthClientCache.get(resolved.config);
        const provider = createOpenAI({
            apiKey: "unused",
            baseURL: client.provider.apiBaseUrl,
            fetch: createAuthenticatedFetch(client)
        });
        return {web_search: provider.tools.webSearch({})};
    }

    if (resolved.config.type === ProviderTypeEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({
            apiKey: resolved.config.apiKey,
            baseURL: validateProviderBaseUrl(resolved.config.baseUrl)
        });
        return {
            google_search: google.tools.googleSearch({}),
            url_context: google.tools.urlContext({})
        } as ToolSet;
    }

    return {};
}
