import path from "node:path";
import type {Plugin} from "vite";

/** Replaces the package's Node-only file token store in browser bundles. */
export function openAIOAuthBrowserPlugin(): Plugin {
    const browserStore = path.resolve(
        __dirname,
        "../src/shims/openaiOauthTokenStoreShim.ts"
    );
    const browserJwt = path.resolve(__dirname, "../src/shims/openaiOauthJwtShim.ts");

    return {
        name: "openai-oauth-browser-store",
        enforce: "pre",
        resolveId(source, importer) {
            if (
                source === "./store.js" &&
                importer?.includes("openai-oauth-ai-provider") &&
                importer.includes("/dist/")
            ) {
                return browserStore;
            }
            if (
                source === "./jwt.js" &&
                importer?.includes("openai-oauth-ai-provider") &&
                importer.includes("/dist/")
            ) {
                return browserJwt;
            }
            return null;
        }
    };
}
