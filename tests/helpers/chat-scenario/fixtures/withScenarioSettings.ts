import {LogseqSettingAccessor} from "../../../../src/logseq/LogseqSettingAccessor";
import type {PluginSettings} from "../../../../src/settings";

/** Restoration also runs when the initial update applies and then rejects. */
export async function withScenarioSettings<T>(
    settings: Partial<PluginSettings>,
    use: () => Promise<T>
): Promise<T> {
    const previous = {...LogseqSettingAccessor.getPluginSettings()};
    try {
        await LogseqSettingAccessor.updatePluginSettings(settings);
        return await use();
    } finally {
        await LogseqSettingAccessor.updatePluginSettings(previous);
    }
}
