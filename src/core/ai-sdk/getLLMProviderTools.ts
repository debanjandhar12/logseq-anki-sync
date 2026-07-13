import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import type {ToolSet} from "ai";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {ProviderEnum, WebToolsProviderEnum} from "./types";

export function getLLMProviderTools(): ToolSet {
    const settings = LogseqSettingAccessor.getPluginSettings();

    if (settings.webToolsProvider !== WebToolsProviderEnum.MODEL_NATIVE) {
        return {};
    }

    if (settings.llmProvider === ProviderEnum.OPENAI) {
        const openai = createOpenAI({apiKey: settings.llmAPIKey});
        return {
            web_search: openai.tools.webSearch({})
        };
    }

    if (settings.llmProvider === ProviderEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({apiKey: settings.llmAPIKey});
        return {
            google_search: google.tools.googleSearch({}),
            url_context: google.tools.urlContext({})
        };
    }

    return {};
}
