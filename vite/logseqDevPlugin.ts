import { Plugin } from "vite";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { get } from "http";

function getLogseqPluginId() {
    try {
        const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf-8");
        return JSON.parse(packageJson).logseq.id;
    } catch (err) {
        console.error("logseqDevPlugin: failed to get valid plugin id", err);
        return "";
    }
}

const requestHtml = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        let data: any[] = [];
        get(url, { headers: { accept: "text/html" } }, (res) => {
            res.on("data", (chunk) => data.push(chunk));
            res.on("end", () => resolve(Buffer.concat(data).toString()));
        }).on("error", reject);
    });
};

export function logseqDevPlugin(): Plugin {
    const pluginId = getLogseqPluginId();
    let outDir = "dist";
    let __devServer: any = null;

    return {
        name: "vite:logseq-dev-plugin",
        apply: "serve", // Ensure this plugin only applies in dev mode
        config(config) {
            if (config.build?.outDir) {
                outDir = config.build.outDir;
            }

            const port = config.server?.port || 5173;
            let host = config.server?.host || "localhost";
            if (host === true) host = "localhost";
            let hostStr = String(host);
            if (hostStr.includes(':') && !hostStr.startsWith('[')) {
                hostStr = `[${hostStr}]`;
            }

            const origin = config.server?.origin || `http://${hostStr}:${port}`;

            // By enforcing base as the dev origin, Vite natively resolves all injected `<script src="/@vite/client">`
            // to `<script src="http://localhost:5173/@vite/client">` making it work cleanly on file:// protocols calls of Logseq Desktop
            return {
                base: `${origin}/`,
                server: {
                    origin,
                    hmr: {
                        host: hostStr,
                    }
                },
            };
        },
        configureServer(server) {
            __devServer = server;
            const tapHtml = () => {
                let address = server.httpServer?.address();
                let port = server.config.server?.port || 5173;
                let host = server.config.server?.host || "localhost";
                if (typeof address === "object" && address) {
                    port = address.port;
                    if (address.address !== '::' && address.address !== '0.0.0.0') {
                        host = address.address;
                    } else if (address.family === 'IPv6') {
                        host = '::1'; // fallback to IPv6 localhost if binding to all interfaces and Vite chose IPv6
                    }
                }

                // If host is an IPv6 address, wrap it in brackets for the URL
                let hostStr = typeof host === "boolean" ? "localhost" : String(host);
                if (hostStr.includes(':') && !hostStr.startsWith('[')) {
                    hostStr = `[${hostStr}]`;
                }

                // Re-fetch index.html from vite server and write to dist folder with modified base
                const url = `http://${hostStr}:${port}`;
                requestHtml(url).then((html) => {
                    const outPath = resolve(process.cwd(), outDir);
                    mkdirSync(outPath, { recursive: true });
                    const outFile = resolve(outPath, "index.html");

                    const baseHref = url.endsWith('/') ? url : url + '/';
                    const baseString = `<base href="${baseHref}">`;
                    let htmlWithBase = html;
                    if (html.includes('<head>')) {
                        htmlWithBase = html.replace('<head>', `<head>\n    ${baseString}`);
                    } else {
                        htmlWithBase = `<head>${baseString}</head>\n` + html;
                    }

                    writeFileSync(outFile, htmlWithBase, {
                        encoding: "utf-8",
                    });
                    console.info(`[logseq-dev-plugin] Wrote development index.html to ${outFile}`);
                }).catch((err) => {
                    console.error("[logseq-dev-plugin] Failed to write development index.html", err);
                });
            };

            if (server.httpServer?.listening) {
                // Wait briefly for Vite to finish fully restarting its middleware pipeline
                setTimeout(tapHtml, 500);
            } else {
                server.httpServer?.once("listening", tapHtml);
            }
        },
        transform(code, id, options) {
            // Do full plugin reload when hrm fails.
            // React Fast Refresh successes are caught at the component level and
            // automatically handled by vite. Hence, those need not be handled here.
            if (
                !/node_modules/.test(id) &&
                id.startsWith(process.cwd()) &&
                (id.endsWith('.ts') || id.endsWith('.js') || id.endsWith('.tsx') || id.endsWith('.jsx'))
            ) {
                // Only inject HRM code to entry file.
                // Entry File = module has no importers (is root)
                const moduleNode = __devServer?.moduleGraph.getModuleById(id);
                const isGraphRoot = moduleNode && moduleNode.importers.size === 0;
                const isLikelyEntry = /[/\\](index|main)\.[tj]sx?$/.test(id);

                if (isGraphRoot || (!moduleNode && isLikelyEntry)) {
                    return {
                        code: `
if (import.meta && import.meta.hot) {
    let isTopAccessible = false;
    try {
        isTopAccessible = !!window.top?.LSPluginCore;
    } catch (e) {}

    if (!isTopAccessible) {
        setTimeout(() => {
          if (logseq && logseq.UI && logseq.UI.showMsg) {
            logseq.UI.showMsg(
              'logseqDevPlugin: window.top is not accessible. Plugin hot reloading is disabled.',
              'error',
              5000
            );
          }
        }, 2000);
        console.error("logseqDevPlugin: window.top is not accessible. Plugin hot reloading is disabled.");
    }

    const __logseqDevPluginReload = () => {
        if (!isTopAccessible) return;
        console.log('logseqDevPlugin: starting a full plugin reload...');
        try {
            const pluginId = ${JSON.stringify(pluginId)};
            if (window.top && window.top.LSPluginCore) {
                window.top.LSPluginCore.reload(pluginId);
            }
            const ls = window.top?.logseq;
            if (ls && ls.api) {
                const currentPage = ls.api.get_current_page();
                if (currentPage?.originalName) {
                    ls.api.replace_state("home");
                    ls.api.replace_state("page", { name: currentPage.originalName });
                } else {
                    ls.api.replace_state("home");
                }
            }
        } catch (e) {
            console.warn("logseqDevPlugin: failed to re-render current logseq page", e);
        }
    };

    import.meta.hot.accept(() => {});
    import.meta.hot.dispose(() => {
        __logseqDevPluginReload();
    });
    
    // Fallback listeners for explicit vite native reload signals
    import.meta.hot.on('vite:beforeFullReload', __logseqDevPluginReload);
}
` + code,
                        map: null,
                    };
                }
            }
            return null;
        }
    };
}
