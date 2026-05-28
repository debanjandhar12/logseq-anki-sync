import React from "react";
import {App} from "../../../chat-app/App";
import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqAppInfoFetcher} from "../../../logseq/LogseqAppInfoFetcher";
import {LogseqSettingAccessor} from "../../../logseq/LogseqSettingAccessor";
import type {ChatCommand} from "../types";
import {
    canShowSidebar,
    getSidebarRendererKey,
    getSidebarUnavailableMessage
} from "./OpenAIChatCommand";

const logger = createLogger(LoggerCategory.CHAT_UI);

/**
 * Initializes AI Chat integrations that must be registered once at plugin startup.
 */
export class InitAIChatCommand implements ChatCommand {
    async execute(): Promise<void> {
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
}
