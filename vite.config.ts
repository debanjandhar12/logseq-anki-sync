import reactPlugin from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite/bundleJSStringPlugin";
import {logseqDevPlugin} from "./vite/logseqDevPlugin";
import {logseqReactBridgePlugin} from "./vite/logseqReactBridgePlugin";
import {rewriteDistReqToRootPlugin} from "./vite/rewriteDistReqToRootPlugin";
import {staticFileSyncTransformPlugin} from "./vite/staticFileSyncTransformPlugin";
import {stripUseClientDirectivePlugin} from "./vite/stripUseClientDirectivePlugin";

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
            stripUseClientDirectivePlugin(),
            logseqReactBridgePlugin(), // Must be first to intercept React imports
            mode === "development" && logseqDevPlugin(), // for dev only
            mode === "development" && reactPlugin(), // for dev only
            mode === "development" && rewriteDistReqToRootPlugin(), // for dev only
            nodePolyfills(),
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
            minify: "esbuild",
            emptyOutDir: true
        },
        css: {
            postcss: {
                plugins: [
                    require("tailwindcss")({config: "./src/ui/tailwind.config.js"}),
                    require("autoprefixer")
                ]
            }
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
            server: {
                deps: {
                    inline: [/@floating-ui/]
                }
            }
        }
    };
});
