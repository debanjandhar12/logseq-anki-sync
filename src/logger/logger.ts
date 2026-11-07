import {Logger, LogLevel} from "tslog";
import {applyLogSource} from "./applyLogSource";
import {formatLogPath} from "./formatLogPath";
import {resolveMinLogLevel} from "./resolveMinLogLevel";

export const logger = new Logger({
    type: "pretty",
    minLevel: LogLevel.ERROR,
    middleware: [applyLogSource],
    // Custom pretty placeholders need explicit caller capture.
    stack: {capture: "full"},
    pretty: {
        enabled: true,
        template:
            "[{{yyyy}}{{mm}}{{dd}} {{hh}}:{{MM}}:{{ss}}] [{{readableFilePathWithLine}}] [{{logLevelName}}] ",
        placeholders: {
            readableFilePathWithLine: (meta) => {
                const source =
                    "sourceFilePathWithLine" in meta ? meta.sourceFilePathWithLine : undefined;
                return formatLogPath(
                    typeof source === "string" ? source : meta.path?.filePathWithLine
                );
            }
        },
        styles: {readableFilePathWithLine: "white"},
        levelMethod: {
            // biome-ignore lint/suspicious/noConsole: Central logger routes native warning output.
            WARN: console.warn.bind(console),
            // biome-ignore lint/suspicious/noConsole: Central logger routes native error output.
            ERROR: console.error.bind(console),
            // biome-ignore lint/suspicious/noConsole: Central logger routes native fatal output.
            FATAL: console.error.bind(console),
            // biome-ignore lint/suspicious/noConsole: Central logger routes remaining native output.
            "*": console.log.bind(console)
        }
    }
}).setMinLevel(resolveMinLogLevel());
