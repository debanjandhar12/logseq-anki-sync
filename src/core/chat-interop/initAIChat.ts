import {LogseqAppInfoFetcher} from "src/logseq/LogseqAppInfoFetcher";
import {
    canShowSidebar,
    getSidebarRendererKey,
    getSidebarUnavailableMessage
} from "src/core/chat-interop/commands/OpenAIChatCommand";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import React from "react";
import {App} from "src/chat-app/App";
import {createLogger, LoggerCategory} from "src/logger";
const logger = createLogger(LoggerCategory.CHAT_UI);

/**
 * This attempts to register the AI Chat sidebar renderer.
 * If this fails, the OpenAIChatCommand will open the AI Chat inside a iframe model.
 */
export const initAIChat = async () => {
    if (!LogseqAppInfoFetcher.checkHostAccess()) return;

    try {
        await logseq.Experiments.registerSidebarRenderer(getSidebarRendererKey(), {
            title: "Logseq AI Chat",
            render: () => {
                const settings = LogseqSettingAccessor.getPluginSettings();
                const openInSidebar = settings.openChatInSidebar ?? true;

                if (!canShowSidebar() || !openInSidebar) {
                    return getSidebarUnavailableMessage();
                }

                return React.createElement(App);
            }
        });
    } catch (error) {
        logger.error("Failed to register AI Chat sidebar renderer", error);
    }
}