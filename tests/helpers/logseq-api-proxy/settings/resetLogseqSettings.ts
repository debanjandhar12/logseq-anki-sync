import type {PluginSettings} from "../../../../src/settings";
import {getDefaultSettings} from "./defaultLogseqSettings";
import {persistSettings} from "./persistLogseqSettings";

export function resetLogseqSettings(): void {
    const settings = getDefaultSettings();
    persistSettings(settings);
    if (typeof logseq !== "undefined") {
        (logseq as unknown as {settings: PluginSettings}).settings = settings;
    }
}
