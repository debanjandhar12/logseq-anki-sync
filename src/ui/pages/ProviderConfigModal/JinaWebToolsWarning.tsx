import React from "react";
import {WebSearchTool} from "src/chat-app/tools/impl/WebSearchTool";
import {hasNativeWebTools} from "src/core/ai-sdk/hasNativeWebTools";
import type {ProviderTypeEnum} from "src/core/ai-sdk/types";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";

export function JinaWebToolsWarning({providerType}: {providerType: ProviderTypeEnum}) {
    const [jinaApiKey, setJinaApiKey] = React.useState(
        () => LogseqSettingAccessor.getPluginSettings().jinaApiKey
    );

    React.useEffect(
        () =>
            LogseqSettingAccessor.registerSettingsChangeListener((settings) => {
                setJinaApiKey(settings.jinaApiKey);
            }),
        []
    );

    if (hasNativeWebTools(providerType) || jinaApiKey?.trim()) return null;

    return (
        <div
            role="alert"
            className="rounded border border-amber-500/60 bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-400">
            The {WebSearchTool.NAME} tool will be disabled unless jina ai api key is provided.
        </div>
    );
}
