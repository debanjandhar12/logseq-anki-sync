import type {PluginSettings} from "../../../../src/settings";
import {persistSettings, readPersistedSettings} from "../settings";

type SettingsListener = (newSettings: PluginSettings, oldSettings: PluginSettings) => void;

export function createLogseqProxySettings() {
    const listeners: SettingsListener[] = [];
    return {
        settings: readPersistedSettings(),
        async updateSettings(partialSettings: Partial<PluginSettings>): Promise<void> {
            const oldSettings = this.settings;
            this.settings = {...oldSettings, ...partialSettings};
            persistSettings(this.settings);
            for (const listener of listeners) listener(this.settings, oldSettings);
        },
        onSettingsChanged(listener: SettingsListener): () => void {
            listeners.push(listener);
            return () => {
                const index = listeners.indexOf(listener);
                if (index >= 0) listeners.splice(index, 1);
            };
        }
    };
}
