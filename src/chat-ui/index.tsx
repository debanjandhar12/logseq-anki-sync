import React from "react";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {LogseqSettingAccessor} from "../logseq/LogseqSettingAccessor";
import {showAIChatModal} from "../ui";
import {App} from "./App";

const sideBarCanBeShown =
    LogseqAppInfoFetcher.checkHostAccess() && process.env.NODE_ENV === "production";
export const showAIChat = async () => {
    const settings = LogseqSettingAccessor.getPluginSettings();
    const openInSidebar = settings.openChatInSidebar ?? true;

    if (openInSidebar && sideBarCanBeShown) {
        logseq.Editor.openInRightSidebar("_sidebar.logseq-ai-chat-ui-sidebar");
    } else {
        await showAIChatModal(<App />);
    }
};

export const initAIChat = async () => {
    if (!LogseqAppInfoFetcher.checkHostAccess()) return;
    try {
        await logseq.Experiments.registerSidebarRenderer("logseq-ai-chat-ui-sidebar", {
            title: "Logseq AI Chat",
            render: () => {
                const settings = LogseqSettingAccessor.getPluginSettings();
                const openInSidebar = settings.openChatInSidebar ?? true;
                if (!sideBarCanBeShown || !openInSidebar)
                    return "Chat Sidebar cannot be shown. This can happen in logseq web version or in a rare event when logseq react object is not accessible.";
                return <App />;
            }
        });
    } catch (e) {
        console.error("Failed to register sidebar renderer", e);
    }
};
