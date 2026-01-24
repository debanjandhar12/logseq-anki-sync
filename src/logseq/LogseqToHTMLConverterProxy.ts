import pMemoize, {pMemoizeClear} from "p-memoize";
import objectHashOptimized from "../utils/objectHashOptimized";
import {WindowParentBridge} from "./WindowParentBridge";
import {LogseqProxy} from "./LogseqProxy";
import {convertToHTMLFile as originalConvertToHTMLFile, HTMLFile, setUseProxyPreprocessor} from "./LogseqToHtmlConverter";

// Re-export HTMLFile type
export type {HTMLFile} from "./LogseqToHtmlConverter";

/**
 * Cached version of convertToHTMLFile that uses LogseqContentPreprocessorProxy internally.
 * This ensures all Logseq API calls within the conversion pipeline use caching.
 * 
 * The cache is cleared after sync completion via 'syncLogseqToAnkiComplete' event.
 */
export const convertToHTMLFile = pMemoize(async (
    content: string,
    format = "markdown",
    opts: { processRefEmbeds?: boolean; displayTags?: boolean } = { processRefEmbeds: true, displayTags: false }
): Promise<HTMLFile> => {
    // Enable proxy preprocessor for caching
    setUseProxyPreprocessor(true);
    try {
        return await originalConvertToHTMLFile(content, format, opts);
    } finally {
        // Reset to non-proxy mode
        setUseProxyPreprocessor(false);
    }
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

