import React from "react";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {LogseqSettingAccessor} from "../logseq/LogseqSettingAccessor";
import {showAIChatModal} from "../ui";
import {App} from "./App";

const sideBarCanBeShown =
    LogseqAppInfoFetcher.checkHostAccess(window.parent) && process.env.NODE_ENV === "production";
export const showAIChat = async () => {
    const settings = LogseqSettingAccessor.getPluginSettings();
    const openInSidebar = settings.openChatInSidebar ?? true;

    if (openInSidebar && sideBarCanBeShown) {
        logseq.Editor.openInRightSidebar("_sidebar.logseq-ai-chat-sidebar");
    } else {
        await showAIChatModal(<App />);
    }
};

export const initAIChat = async () => {
    await logseq.Experiments.registerSidebarRenderer("logseq-ai-chat-sidebar", {
        title: "Logseq AI Chat",
        render: () => {
            const settings = LogseqSettingAccessor.getPluginSettings();
            const openInSidebar = settings.openChatInSidebar ?? true;
            if (!sideBarCanBeShown || !openInSidebar)
                return "Chat Sidebar cannot be shown. This can happen in logseq web version or in a rare event when logseq react object is not accessible.";
            return <App />;
        }
    });
};
