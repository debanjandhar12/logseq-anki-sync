import { LogseqProxy } from "../logseq/LogseqProxy";

export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
    private context: string;
    private debugKey?: string;

    constructor(context: string, debugKey?: string) {
        this.context = context;
        this.debugKey = debugKey;
    }

    private shouldLog(level: LogLevel): boolean {
        // Always log warnings and errors
        if (level === "warn" || level === "error") return true;

        // For debug/info, check if debugging is enabled for this file
        if (this.debugKey) {
            try {
                const settings = LogseqProxy.Settings.getPluginSettings();
                return settings?.debug?.includes(this.debugKey) ?? false;
            } catch {
                return false;
            }
        }

        // If no debug key, only log info by default
        return level === "info";
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `[${timestamp}] [${this.context}]`;
        return [`${prefix} ${message}`, ...args];
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog("debug")) {
            console.log(...this.formatMessage("debug", message, ...args));
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.shouldLog("info")) {
            console.log(...this.formatMessage("info", message, ...args));
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.shouldLog("warn")) {
            console.warn(...this.formatMessage("warn", message, ...args));
        }
    }

    error(message: string, ...args: any[]): void {
        if (this.shouldLog("error")) {
            console.error(...this.formatMessage("error", message, ...args));
        }
    }

    /**
     * Create a scoped logger for a specific operation
     */
    scope(scopeName: string): Logger {
        return new Logger(`${this.context}:${scopeName}`, this.debugKey);
    }
}

/**
 * Factory function to create loggers
 */
export function createLogger(context: string, debugKey?: string): Logger {
    return new Logger(context, debugKey);
}
