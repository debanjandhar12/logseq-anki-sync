import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {ProviderEnum} from "./types";

export async function getLLMModel(modelId: string) {
    const llmProvider = LogseqSettingAccessor.getPluginSettings().llmProvider;
    const llmAPIUrl = LogseqSettingAccessor.getPluginSettings().llmAPIUrl;
    const llmAPIKey = LogseqSettingAccessor.getPluginSettings().llmAPIKey;

    if (!llmProvider) {
        throw new Error("LLM provider not set");
    }
    if (!llmAPIKey) {
        throw new Error("LLM API Key not set");
    }
    if (!modelId) {
        throw new Error("LLM Model not selected");
    }

    if (llmProvider === ProviderEnum.OPENAI) {
        const openai = createOpenAI({
            apiKey: llmAPIKey
        });
        return openai.responses(modelId); // responses() is required for provider-defined tools like web_search
    } else if (llmProvider === ProviderEnum.OPENAI_COMPATIBLE) {
        if (!llmAPIUrl) {
            throw new Error("LLM API URL not set");
        }
        const openaiCompatible = createOpenAICompatible({
            name: "openai-compatible",
            baseURL: llmAPIUrl,
            apiKey: llmAPIKey
        });
        return openaiCompatible.chatModel(modelId);
    } else if (llmProvider === ProviderEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({
            apiKey: llmAPIKey
        });
        return google.chat(modelId);
    }

    throw new Error("Unsupported LLM provider");
}
