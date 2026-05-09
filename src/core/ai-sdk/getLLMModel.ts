import {createOpenAI} from "@ai-sdk/openai";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {ProviderEnum} from "./types";
import {createGoogleGenerativeAI} from "@ai-sdk/google";

export async function getLLMModel() {
    const llmProvider = LogseqSettingAccessor.getPluginSettings().llmProvider;
    const llmAPIUrl = LogseqSettingAccessor.getPluginSettings().llmAPIUrl;
    const llmAPIKey = LogseqSettingAccessor.getPluginSettings().llmAPIKey;
    const llmAPIModel = LogseqSettingAccessor.getPluginSettings().llmAPIModel;

    if (llmProvider === ProviderEnum.OPENAI) {
        const openai = createOpenAI({
            baseURL: llmAPIUrl,
            apiKey: llmAPIKey,
        });
        return openai.chat(llmAPIModel);
    } else if (llmProvider === ProviderEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({
            apiKey: llmAPIKey,
            baseURL: llmAPIUrl
        })
        return google.chat(llmAPIModel);
    }

    throw new Error("Unsupported LLM provider");
}