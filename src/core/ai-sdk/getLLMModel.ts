import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {readProviderConfigs} from "./provider-config/readProviderConfigs";
import {
    type ResolvedLLMSelection,
    resolveLLMSelection
} from "./provider-config/resolveLLMSelection";
import {validateProviderBaseUrl} from "./provider-config/validateProviderConfig";
import {ProviderTypeEnum} from "./types";

export function createLLMModel({config, rawModelId}: ResolvedLLMSelection) {
    const baseURL = validateProviderBaseUrl(config.baseUrl);
    if (config.type === ProviderTypeEnum.OPENAI) {
        const openai = createOpenAI({
            apiKey: config.apiKey,
            baseURL
        });
        return openai.responses(rawModelId);
    }
    if (config.type === ProviderTypeEnum.OPENAI_COMPATIBLE) {
        const openaiCompatible = createOpenAICompatible({
            name: config.id,
            baseURL,
            apiKey: config.apiKey
        });
        return openaiCompatible.chatModel(rawModelId);
    }
    if (config.type === ProviderTypeEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({
            apiKey: config.apiKey,
            baseURL
        });
        return google.chat(rawModelId);
    }
    throw new Error("Unsupported LLM provider");
}

export async function getLLMModel(selectedModelId: string) {
    return createLLMModel(resolveLLMSelection(selectedModelId, readProviderConfigs()));
}
