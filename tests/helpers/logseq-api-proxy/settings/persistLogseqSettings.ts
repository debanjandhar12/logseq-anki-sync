import type {PluginSettings} from "../../../../src/settings";
import {getDefaultSettings} from "./defaultLogseqSettings";

const LOGSEQ_SETTINGS_STORAGE_KEY = "logseq-astro-box-test-settings";

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
    return getDefaultSettings();
}

export function persistSettings(settings: PluginSettings): void {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(LOGSEQ_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
}
