import React from "react";
import {App} from "../../../chat-app/App";
import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqAppInfoFetcher} from "../../../logseq/LogseqAppInfoFetcher";
import {LogseqSettingAccessor} from "../../../logseq/LogseqSettingAccessor";
import {showAIChatModal} from "../../../ui";
import type {ChatCommand} from "../types";

const logger = createLogger(LoggerCategory.CHAT_UI);
const sidebarRendererKey = "logseq-ai-chat-ui-sidebar";
const sidebarPageName = `_sidebar.${sidebarRendererKey}`;

/**
 * Opens the AI Chat interface.
 */
export class OpenAIChatCommand implements ChatCommand {
    static readonly TYPE = "open-ai-chat";

    async execute(): Promise<void> {
        const settings = LogseqSettingAccessor.getPluginSettings();
        const openInSidebar = settings.openChatInSidebar ?? true;

        if (openInSidebar && canShowSidebar()) {
            await logseq.Editor.openInRightSidebar(sidebarPageName);
            await logseq.App.setRightSidebarVisible(true);
            return;
        }

        await showAIChatModal(React.createElement(App));
    }
}

export function canShowSidebar(): boolean {
    return LogseqAppInfoFetcher.checkHostAccess() && process.env.NODE_ENV === "production";
}

export function getSidebarRendererKey(): string {
    return sidebarRendererKey;
}

export function getSidebarUnavailableMessage(): string {
    return "Chat Sidebar cannot be shown. This can happen in logseq web version or in a rare event when logseq react object is not accessible.";
}