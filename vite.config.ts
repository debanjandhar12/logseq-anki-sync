import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite-plugins/bundleJSStringPlugin";
import {inlineSkillFilePlugin} from "./vite-plugins/inlineSkillFilePlugin";
import {logseqDevPlugin} from "./vite-plugins/logseqDevPlugin";
import {logseqReactBridgePlugin} from "./vite-plugins/logseqReactBridgePlugin";
import {openAIOAuthBrowserPlugin} from "./vite-plugins/openAIOAuthBrowserPlugin";
import {rewriteDistReqToRootPlugin} from "./vite-plugins/rewriteDistReqToRootPlugin";
import {shadowDOMFloatingUIReactPopperBridgePlugin} from "./vite-plugins/shadowDOMFloatingUIReactPopperBridgePlugin";
import {staticFileSyncTransformPlugin} from "./vite-plugins/staticFileSyncTransformPlugin";
import {stripUseClientDirectivePlugin} from "./vite-plugins/stripUseClientDirectivePlugin";

// https://vitejs.dev/config/

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        base: "./",
        cacheDir: ".vite_cache",
        resolve: {
            dedupe: ["react", "react-dom"],
            alias: {
                // Required for src/ imports used in shadcn
                src: path.resolve(__dirname, "./src")
            }
        },
        plugins: [
            tailwindcss(),
            inlineSkillFilePlugin(),
            stripUseClientDirectivePlugin(),
            logseqReactBridgePlugin(), // Must be first to intercept React imports
            shadowDOMFloatingUIReactPopperBridgePlugin(),
            mode === "development" && logseqDevPlugin(), // for dev only
            mode === "development" && reactPlugin(), // for dev only
            mode === "development" && rewriteDistReqToRootPlugin(), // for dev only
            openAIOAuthBrowserPlugin(),
            nodePolyfills({
                globals: {
                    process: mode !== "test"
                }
            }),
            staticFileSyncTransformPlugin(),
            bundleJSStringPlugin(mode)
        ],
        define: {
            "process.env": JSON.stringify({...env, NODE_ENV: mode})
        },
        server: {
            port: 5173,
            cors: true,
            watch: {
                ignored: ["**/dist/**", "**/node_modules/**"]
            }
        },
        build: {
            sourcemap: true,
            target: "esnext",
            minify: "oxc",
            emptyOutDir: true,
            reportCompressedSize: true
        },
        test: {
            include: ["**/*.test.ts"],
            exclude: ["**/logseq-dev-plugin/**", "**/node_modules/**"],
            setupFiles: ["./tests/setup.ts"],
            environment: "jsdom",
            env: {...env, NODE_ENV: mode},
            pool: "forks",
            singleFork: true,
            fileParallelism: false,
            sequence: {
                concurrent: false
            },
            server: {
                deps: {
                    inline: [/@floating-ui/]
                }
            }
        }
    };
});
