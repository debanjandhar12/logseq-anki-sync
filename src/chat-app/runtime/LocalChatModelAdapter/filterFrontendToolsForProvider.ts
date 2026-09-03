import type {Tool} from "assistant-stream";
import {WebPageGetTool} from "src/chat-app/tools/impl/WebPageGetTool";
import {WebSearchTool} from "src/chat-app/tools/impl/WebSearchTool";
import {hasNativeWebTools} from "src/core/ai-sdk/hasNativeWebTools";
import type {ProviderTypeEnum} from "src/core/ai-sdk/types";

export function filterFrontendToolsForProvider<T extends Tool>(
    tools: Readonly<Record<string, T>> | undefined,
    providerType: ProviderTypeEnum,
    jinaApiKey: string | undefined
): Record<string, T> | undefined {
    const canUseJina = !hasNativeWebTools(providerType) && Boolean(jinaApiKey?.trim());
    if (!tools || canUseJina) return tools;

    const filteredTools = {...tools};
    delete filteredTools[WebSearchTool.NAME];
    delete filteredTools[WebPageGetTool.NAME];
    return filteredTools;
}
