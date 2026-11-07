import type {ILogObj, LogMiddleware} from "tslog";

export const LOG_SOURCE_KEY = "logseq-anki-sync.log-source";
export const LOG_SOURCE_SYMBOL = Symbol.for(LOG_SOURCE_KEY);

/** Consume the source marker inserted by the build before tslog formats the arguments. */
export const applyLogSource: LogMiddleware<ILogObj> = (context) => {
    const marker = context.args[0];
    if (marker === null || typeof marker !== "object") return context;
    const source = marker[LOG_SOURCE_SYMBOL];
    if (typeof source !== "string") return context;

    const separator = source.lastIndexOf(":");
    const fileLine = source.slice(separator + 1);
    if (separator < 1 || !/^[1-9]\d*$/.test(fileLine)) return context;

    context.args = context.args.slice(1);
    // Keep tslog's single-function lazy argument behavior after removing the marker.
    if (
        context.args.length === 1 &&
        typeof context.args[0] === "function" &&
        context.args[0].length === 0
    ) {
        const result = context.args[0]();
        context.args = Array.isArray(result) ? [...result] : [result];
    }

    context.meta.sourceFilePathWithLine = source;
    return context;
};
