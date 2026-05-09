import React from "../ui/React";
import {App} from "./App";

export const showAIChat = async () => {
    logseq.Editor.openInRightSidebar("_sidebar.logseq-ai-chat-sidebar");
};

export const initAIChat = async () => {
    await logseq.Experiments.registerSidebarRenderer("logseq-ai-chat-sidebar", {
        title: "Logseq AI Chat",
        render: () => <App />
    });
};
