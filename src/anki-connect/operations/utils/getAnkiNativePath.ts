import {createLogger, LoggerCategory} from "../../../logger";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

/**
 * Convert Logseq SDK-resolved local asset URL into AnkiConnect's filesystem path.
 */
export function getAnkiNativePath(source: string): string | null {
    if (/^blob:/i.test(source)) {
        // DB-web blob URLs refer to browser storage, not files Anki can open.
        logger.error("Failed to read browser-backed asset", {url: source});
        return null;
    }

    try {
        let nativePath: string;
        if (/^file:/i.test(source)) {
            const url = new URL(source);
            nativePath = decodeURIComponent(url.pathname);
            if (url.hostname && url.hostname !== "localhost") {
                nativePath = `//${url.hostname}${nativePath}`;
            }
            nativePath = nativePath.replace(/^\/([a-zA-Z]:\/)/, "$1");
        } else if (/^assets:\/\//i.test(source)) {
            // Logseq's Electron handler restores the literal drive marker before
            // decoding. Strip URL query/fragment before decoding encoded ?/# names.
            const encodedPath = source.slice("assets://".length).split(/[?#]/, 1)[0];
            if (!encodedPath) throw new Error("Empty asset URL");
            nativePath = decodeURIComponent(
                encodedPath.replace(/^(\/?[a-zA-Z])\/logseq__colon\//, "$1:/")
            ).replace(/\\/g, "/");
            if (!nativePath.startsWith("/") && !/^[a-zA-Z]:\//.test(nativePath)) {
                // Logseq emits assets://server/share for Windows UNC paths.
                nativePath = `//${nativePath}`;
            }
            nativePath = nativePath.replace(/^\/([a-zA-Z]:\/)/, "$1");
        } else if (/^[a-zA-Z]:[\\/]/.test(source) || /^[\\/]/.test(source)) {
            nativePath = source;
        } else {
            throw new Error("Expected an absolute filesystem path or a resolved local asset URL");
        }

        if (!nativePath || nativePath.includes("\0")) throw new Error("Invalid native asset path");
        return nativePath;
    } catch (error) {
        logger.error("Failed to resolve native asset path", {url: source, error});
        return null;
    }
}
