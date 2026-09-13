import type {PluginSettings} from "../../../src/settings";
import {MOCK_LOGSEQ_SETTINGS} from "../../../src/tests/constants";

const LOGSEQ_SETTINGS_STORAGE_KEY = "logseq-ai-chat-test-settings";

let defaultSettings: PluginSettings = MOCK_LOGSEQ_SETTINGS;

export function setDefaultSettings(settings: Partial<PluginSettings>): void {
    defaultSettings = {...MOCK_LOGSEQ_SETTINGS, ...settings};
}

export function resetLogseqSettings(): void {
    persistSettings({...defaultSettings});
    if (typeof logseq !== "undefined") {
        (logseq as unknown as {settings: PluginSettings}).settings = {
            ...defaultSettings
        };
    }
}

export function readPersistedSettings(): PluginSettings {
    if (typeof localStorage !== "undefined") {
        const persistedSettings = localStorage.getItem(LOGSEQ_SETTINGS_STORAGE_KEY);
        if (persistedSettings) {
            try {
                return JSON.parse(persistedSettings) as PluginSettings;
            } catch {
                localStorage.removeItem(LOGSEQ_SETTINGS_STORAGE_KEY);
            }
        }
    }
    return {...defaultSettings};
}

export function persistSettings(settings: PluginSettings): void {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(LOGSEQ_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
}
