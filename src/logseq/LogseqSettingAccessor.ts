import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import type {PluginSettings} from "../settings";

export class LogseqSettingAccessor {
    static init() {
        logseq.onSettingsChanged((newSettings, oldSettings) => {
            for (const listener of LogseqSettingAccessor.registeredSettingsChangeListeners) {
                listener(newSettings, oldSettings);
            }
        });
    }

    static useSettingsSchema(schemas: Array<SettingSchemaDesc>): void {
        logseq.useSettingsSchema(schemas);
    }

    static registeredSettingsChangeListeners: Array<
        (newSettings: PluginSettings, oldSettings: PluginSettings) => void
    > = [];
    static registerSettingsChangeListener(
        listener: (newSettings: PluginSettings, oldSettings: PluginSettings) => void
    ): void {
        LogseqSettingAccessor.registeredSettingsChangeListeners.push(listener);
    }

    static getPluginSettings(): PluginSettings {
        return logseq.settings as PluginSettings;
    }

    static async updatePluginSettings(partialSettings: Partial<PluginSettings>): Promise<void> {
        await logseq.updateSettings(partialSettings);
    }
}
