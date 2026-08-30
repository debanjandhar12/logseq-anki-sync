import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqSettingAccessor} from "../../../logseq/LogseqSettingAccessor";
import type {ProviderConfig} from "../types";
import {decodeProviderConfigs} from "./providerConfigCodec";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export function readProviderConfigs(): ProviderConfig[] {
    const settings = LogseqSettingAccessor.getPluginSettings() as unknown as {
        providerConfigSetting?: string;
    };
    if (!settings.providerConfigSetting) return [];

    try {
        return decodeProviderConfigs(settings.providerConfigSetting);
    } catch {
        logger.warn("Failed to read provider configurations; using an empty list");
        return [];
    }
}
