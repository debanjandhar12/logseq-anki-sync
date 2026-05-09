import {type ConsolaInstance, createConsola, LogLevels} from "consola";
import type {LoggerCategory} from "./types";

function getEnvLogLevel(): number {
    if (import.meta.env.PROD) {
        return LogLevels.error;
    }

    if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
        const testLevel = import.meta.env.VITE_TEST_LOG_LEVEL?.toLowerCase();
        switch (testLevel) {
            case "silent":
                return LogLevels.silent;
            case "error":
                return LogLevels.error;
            case "warn":
                return LogLevels.warn;
            case "info":
                return LogLevels.info;
            case "debug":
                return LogLevels.debug;
            case "trace":
                return LogLevels.trace;
            default:
                return LogLevels.warn;
        }
    }

    return LogLevels.warn;
}

function getLogLevelForCategory(category: LoggerCategory): number {
    // Directly access logseq.settings to avoid circular dependency with LogseqProxy
    const settings = logseq.settings as {debug?: string[]} | null;
    const debug = settings?.debug || [];
    if (debug.includes(category as string)) {
        return LogLevels.info;
    }
    return getEnvLogLevel();
}

let loggerCache: Map<LoggerCategory, ConsolaInstance> | null = null;

export function createLogger(category: LoggerCategory): ConsolaInstance {
    if (!loggerCache) {
        loggerCache = new Map();
    }

    if (loggerCache.has(category)) {
        return loggerCache.get(category)!;
    }

    const level = getLogLevelForCategory(category);
    const logger = createConsola({
        level,
        formatOptions: {
            date: true,
            colors: true
        }
    }).withTag(category);

    loggerCache.set(category, logger);
    return logger;
}

export function updateLoggerLevels(): void {
    if (!loggerCache) return;
    for (const [category, logger] of loggerCache.entries()) {
        logger.level = getLogLevelForCategory(category);
    }
}
