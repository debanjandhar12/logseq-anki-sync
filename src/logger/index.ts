/**
 * Centralized logging utility with category-based log levels and settings integration.
 */
import { createConsola, ConsolaInstance, LogLevels } from 'consola';
import { LogseqProxy } from '../logseq/LogseqProxy';

/**
 * Logger categories for different parts of the application.
 * Each category can be independently enabled for info-level logging via settings.
 */
export enum LoggerCategory {
  AnkiConnect = 'Anki Connect',
  LazyAnkiNoteManager = 'Lazy Anki Note Manager',
  LazyAnkiNoteManagerInternal = 'Lazy Anki Note Manager Internal',
  AnkiNotes = 'Anki Notes',
  LogseqWrappers = 'Logseq Wrappers',
  SyncCacheLayer = 'Sync Cache Layer',
  LogseqContentConverter = 'Logseq Content Converter',
  SyncMain = 'Sync Main',
  SyncInternal = 'Sync Internal',
  Others = 'Others',
}

/**
 * Cache for logger instances (one per category)
 */
const loggerCache = new Map<LoggerCategory, ConsolaInstance>();

/**
 * Determines the default log level based on environment
 * Note: Vite replaces import.meta.env.* at build time
 */
function getDefaultLogLevel(): number {
  // Production: only errors (Vite replaces this at build time)
  // @ts-ignore - Vite will replace this
  if (import.meta.env.PROD) {
    return LogLevels.error;
  }

  // Test environment: use VITE_TEST_LOG_LEVEL or default to warn
  // @ts-ignore - Vite will replace this
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    // @ts-ignore - Vite will replace this
    const testLevel = import.meta.env.VITE_TEST_LOG_LEVEL?.toLowerCase();
    switch (testLevel) {
      case 'silent':
        return LogLevels.silent;
      case 'error':
        return LogLevels.error;
      case 'warn':
        return LogLevels.warn;
      case 'info':
        return LogLevels.info;
      case 'debug':
        return LogLevels.debug;
      case 'trace':
        return LogLevels.trace;
      default:
        return LogLevels.warn;
    }
  }

  // Development: warn level
  return LogLevels.warn;
}

/**
 * Gets the log level for a specific category based on settings
 */
function getLogLevelForCategory(category: LoggerCategory): number {
  const defaultLevel = getDefaultLogLevel();

  // If default level is already info or higher, use it
  if (defaultLevel >= LogLevels.info) {
    return defaultLevel;
  }

  // Check if this category is enabled in settings for info logging
  try {
    const settings = LogseqProxy.Settings.getPluginSettings();
    const debugCategories = settings?.debug || [];

    if (debugCategories.includes(category as any)) {
      return LogLevels.info;
    }
  } catch (error) {
    // Settings not available yet, use default
  }

  return defaultLevel;
}

/**
 * Creates or retrieves a cached logger instance for the given category
 */
export function createLogger(category: LoggerCategory): ConsolaInstance {
  // Return cached instance if exists
  if (loggerCache.has(category)) {
    return loggerCache.get(category)!;
  }

  // Create new logger instance
  const level = getLogLevelForCategory(category);
  const logger = createConsola({
    level,
    formatOptions: {
      date: true,
      colors: true,
    },
  }).withTag(category);

  // Cache and return
  loggerCache.set(category, logger);
  return logger;
}

/**
 * Updates log levels for all cached loggers based on current settings.
 * Called when settings change to apply new debug category selections.
 */
export function updateLoggerLevels(): void {
  for (const [category, logger] of loggerCache.entries()) {
    const newLevel = getLogLevelForCategory(category);
    logger.level = newLevel;
  }
}
