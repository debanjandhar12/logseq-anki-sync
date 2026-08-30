import {createLogger, LoggerCategory} from "../../../logger";
import type {ProviderConfig} from "../types";
import {ProviderConfigRepository} from "./ProviderConfigRepository";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

export function readProviderConfigs(): ProviderConfig[] {
    try {
        return ProviderConfigRepository.read();
    } catch {
        logger.warn("Failed to read provider configurations; using an empty list");
        return [];
    }
}
