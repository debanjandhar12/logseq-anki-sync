/**
 * This rewrites requests from logseq web of dist folder to main url.
 * Why? Vite 7 mounts dist folder as root! This means /dist/index.html done from logseq web client will fail.
 * Note: In dev mode, /dist folder is created by vite-logseq-plugin.
 */
export function rewriteDistReqToRootPlugin() {
    return {
        name: "rewrite-dist-to-root",
        enforce: "pre" as const,
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url && req.url.startsWith("/dist/")) {
                    req.url = req.url.replace(/^\/dist\//, "/");
                }
                next();
            });
        }
    };
}