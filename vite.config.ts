import tailwindcss from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite-plugins/bundleJSStringPlugin.ts";
import {logseqDevPlugin} from "./vite-plugins/logseqDevPlugin.ts";
import {logseqReactBridgePlugin} from "./vite-plugins/logseqReactBridgePlugin/index.ts";
import {rewriteDistReqToRootPlugin} from "./vite-plugins/rewriteDistReqToRootPlugin.ts";
import {staticFileSyncTransformPlugin} from "./vite-plugins/staticFileSyncTransformPlugin.ts";

// https://vitejs.dev/config/

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        base: "./",
        cacheDir: ".vite_cache",
        resolve: {
            dedupe: ["react", "react-dom"]
        },
        plugins: [
            tailwindcss(),
            logseqReactBridgePlugin(),
            mode === "development" && logseqDevPlugin(), // for dev only
            mode === "development" && reactPlugin(), // for dev only
            mode === "development" && rewriteDistReqToRootPlugin(), // for dev only
            nodePolyfills({
                globals: {
                    Buffer: true,
                    process: mode !== "test"
                }
            }),
            staticFileSyncTransformPlugin(),
            bundleJSStringPlugin(mode)
        ],
        define: {
            "process.env": JSON.stringify({...env, NODE_ENV: mode})
        },
        optimizeDeps: {
            include: [
                "vite-plugin-node-polyfills/shims/buffer",
                "vite-plugin-node-polyfills/shims/global"
            ]
        },
        server: {
            port: 5173,
            cors: true,
            watch: {
                ignored: ["**/dist/**", "**/node_modules/**", "**/.vitest/**"]
            }
        },
        build: {
            sourcemap: true,
            target: "esnext",
            minify: "oxc",
            emptyOutDir: true,
            reportCompressedSize: true
        },
        worker: {
            format: "es"
        },
        test: {
            include: ["**/*.test.{ts,tsx}"],
            exclude: ["**/logseq-dev-plugin/**", "**/node_modules/**"],
            setupFiles: ["./tests/setup.ts"],
            environment: "jsdom",
            env: {...env, NODE_ENV: mode},
            pool: "forks",
            maxWorkers: 1,
            fileParallelism: false,
            server: {
                deps: {
                    inline: [/@floating-ui/]
                }
            }
        }
    };
});
