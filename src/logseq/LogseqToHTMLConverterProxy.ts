import pMemoize, {pMemoizeClear} from "p-memoize";
import objectHashOptimized from "../utils/objectHashOptimized";
import {WindowParentBridge} from "./WindowParentBridge";
import {LogseqProxy} from "./LogseqProxy";
import {convertToHTMLFile as originalConvertToHTMLFile, HTMLFile} from "./LogseqToHtmlConverter";

// Re-export HTMLFile type
export type {HTMLFile} from "./LogseqToHtmlConverter";

export const convertToHTMLFile = pMemoize(async (
    content: string,
    format = "markdown",
    opts: { processRefEmbeds?: boolean; displayTags?: boolean } = { processRefEmbeds: true, displayTags: false }
): Promise<HTMLFile> => {
    return await originalConvertToHTMLFile(content, format, opts);
}, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

// Initialize cache clearing on sync complete
if (typeof window !== 'undefined') {
    WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug?.includes("LogseqToHtmlConverter.ts")) {
            console.log("[LogseqToHtmlConverterProxy] Clearing HTML conversion cache");
        }
        pMemoizeClear(convertToHTMLFile);
    });
}
