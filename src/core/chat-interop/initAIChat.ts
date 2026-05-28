import React from "react";
import {App} from "src/chat-app/App";
import {
    canShowSidebar,
    getSidebarRendererKey,
    getSidebarUnavailableMessage
} from "src/core/chat-interop/commands/OpenAIChatCommand";
import {createLogger, LoggerCategory} from "src/logger";
import {LogseqAppInfoFetcher} from "src/logseq/LogseqAppInfoFetcher";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";

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
};
