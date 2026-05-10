import React from "../ui/React";
import {showAIChatModal} from "../ui";
import {LogseqSettingAccessor} from "../logseq/LogseqSettingAccessor";
import {App} from "./App";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";

export const showAIChat = async () => {
    const settings = LogseqSettingAccessor.getPluginSettings();
    const openInSidebar = settings.openChatInSidebar ?? true;

    if (openInSidebar && LogseqAppInfoFetcher.checkHostAccess(window.parent) && process.env.NODE_ENV === "production") {
        logseq.Editor.openInRightSidebar("_sidebar.logseq-ai-chat-sidebar");
    } else {
        await showAIChatModal(<App />);
    }
};

export const initAIChat = async () => {
    await logseq.Experiments.registerSidebarRenderer("logseq-ai-chat-sidebar", {
        title: "Logseq AI Chat",
        render: () => <App />
    });
};
