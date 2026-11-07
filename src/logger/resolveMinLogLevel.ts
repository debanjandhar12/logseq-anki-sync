import {LogLevel, type TLogLevelName} from "tslog";

function parseLogLevel(value: unknown): LogLevel | undefined {
    if (typeof value !== "string") return undefined;
    const level = LogLevel[value.trim().toUpperCase() as TLogLevelName];
    return typeof level === "number" ? level : undefined;
}

export function resolveMinLogLevel(value?: unknown): number {
    if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
        const override = import.meta.env.VITE_TEST_LOG_LEVEL?.trim().toUpperCase();
        if (override === "SILENT") return LogLevel.FATAL + 1;
        const testLevel = parseLogLevel(override);
        if (testLevel !== undefined) return testLevel;
    }
    return parseLogLevel(value) ?? LogLevel.ERROR;
}
