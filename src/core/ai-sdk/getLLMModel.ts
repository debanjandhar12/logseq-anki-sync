import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {ProviderEnum} from "./types";

export async function getLLMModel() {
    const llmProvider = LogseqSettingAccessor.getPluginSettings().llmProvider;
    const llmAPIUrl = LogseqSettingAccessor.getPluginSettings().llmAPIUrl;
    const llmAPIKey = LogseqSettingAccessor.getPluginSettings().llmAPIKey;
    const llmAPIModel = LogseqSettingAccessor.getPluginSettings().llmAPIModel;

    if (!llmProvider) {
        throw new Error("LLM provider not set");
    }
    if (!llmAPIUrl) {
        throw new Error("LLM API URL not set");
    }
    if (!llmAPIKey) {
        throw new Error("LLM API Key not set");
    }
    if (!llmAPIModel) {
        throw new Error("LLM API Model not set");
    }

    if (llmProvider === ProviderEnum.OPENAI) {
        const openai = createOpenAI({
            baseURL: llmAPIUrl,
            apiKey: llmAPIKey
        });
        return openai.chat(llmAPIModel);
    } else if (llmProvider === ProviderEnum.OPENAI_COMPATIBLE) {
        const openaiCompatible = createOpenAICompatible({
            name: "openai-compatible",
            baseURL: llmAPIUrl,
            apiKey: llmAPIKey
        });
        return openaiCompatible.chatModel(llmAPIModel);
    } else if (llmProvider === ProviderEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({
            apiKey: llmAPIKey,
            baseURL: llmAPIUrl
        });
        return google.chat(llmAPIModel);
    }

    throw new Error("Unsupported LLM provider");
}
