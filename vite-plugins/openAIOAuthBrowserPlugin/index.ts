import path from "node:path";
import type {Plugin} from "vite";

const PACKAGE_DIST_SEGMENT = "/node_modules/openai-oauth-ai-provider/dist/";

function normalizeModuleId(id: string): string {
    return id.split("?", 1)[0].replaceAll("\\", "/");
}

export function openAIOAuthBrowserPlugin(): Plugin {
    const storeCompat = path.resolve(import.meta.dirname, "openAIOAuthStoreCompat.ts");
    const jwtCompat = path.resolve(import.meta.dirname, "openAIOAuthJwtCompat.ts");

    return {
        name: "openai-oauth-browser-compat",
        enforce: "pre",
        resolveId(source, importer) {
            if (!importer || (source !== "./store.js" && source !== "./jwt.js")) return null;
            const normalizedImporter = normalizeModuleId(importer);
            const packageIndex = normalizedImporter.lastIndexOf(PACKAGE_DIST_SEGMENT);
            if (packageIndex < 0) return null;
            const packageModule = normalizedImporter.slice(
                packageIndex + PACKAGE_DIST_SEGMENT.length
            );
            if (packageModule !== "auth.js" && packageModule !== "core.js") return null;
            return source === "./store.js" ? storeCompat : jwtCompat;
        }
    };
}
