import type {PluginSettings} from "../../../../src/settings";
import {MOCK_LOGSEQ_SETTINGS} from "../../../../src/tests/constants";

let defaultSettings: PluginSettings = MOCK_LOGSEQ_SETTINGS;

export function setDefaultSettings(settings: Partial<PluginSettings>): void {
    defaultSettings = {...MOCK_LOGSEQ_SETTINGS, ...settings};
}

export function getDefaultSettings(): PluginSettings {
    return {...defaultSettings};
}
