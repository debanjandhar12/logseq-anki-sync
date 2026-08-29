export const DONATE_ICON =
    "https://img.shields.io/github/sponsors/debanjandhar12.svg?logo=github&style=flat&height=60&label=Donate&cacheSeconds=28800&color=orange";

export const ATTACHMENT_IMAGE_FORMAT = ["png", "jpeg", "webp"] as const;

export const CHAT_APP_AGENT_MAX_STEPS = 24;

export const CHAT_APP_AGENT_ANYDOC_PAGE_ERROR_THRESHOLD = 0.5;

export const CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR = 120000;

export const LOGSEQ_DB_TRANSACTION_COMMAND_DELAY_MS = 320;

export enum LogseqModelAction {
    SHOW_AI_CHAT = "showAIChat",
    OPEN_SKILL_EDITOR_SETTINGS = "openSkillEditorFromSettings",
    OPEN_COMMAND_EDITOR_SETTINGS = "openCommandEditorFromSettings"
}
