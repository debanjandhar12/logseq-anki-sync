import proxyLogseq from "logseq-proxy";
import type {PluginSettings} from "../../../src/settings";
import {persistSettings, readPersistedSettings} from "./logseqProxySettings";

export function createLogseqProxy({
    apiServer,
    apiToken
}: {
    apiServer: string;
    apiToken: string;
}): void {
    proxyLogseq({
        settings: readPersistedSettings() as unknown as Record<string, unknown>,
        config: {apiServer, apiToken}
    });

    if (typeof logseq === "undefined") return;

    const testLogseq = logseq as typeof logseq & {
        settings: PluginSettings;
        updateSettings: (partialSettings: Partial<PluginSettings>) => Promise<void>;
        onSettingsChanged: (
            listener: (newSettings: PluginSettings, oldSettings: PluginSettings) => void
        ) => () => void;
    };
    const settingsListeners: Array<
        (newSettings: PluginSettings, oldSettings: PluginSettings) => void
    > = [];
    testLogseq.updateSettings = async (partialSettings: Partial<PluginSettings>) => {
        const oldSettings = testLogseq.settings;
        const newSettings = {...oldSettings, ...partialSettings};
        testLogseq.settings = newSettings;
        persistSettings(newSettings);
        for (const listener of settingsListeners) listener(newSettings, oldSettings);
    };
    testLogseq.onSettingsChanged = (listener) => {
        settingsListeners.push(listener);
        return () => {
            const index = settingsListeners.indexOf(listener);
            if (index >= 0) settingsListeners.splice(index, 1);
        };
    };
}
