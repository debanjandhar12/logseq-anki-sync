import {createRequire} from "node:module";
import reactPlugin from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite/bundleJSStringPlugin.ts";
import {logseqDevPlugin} from "./vite/logseqDevPlugin.ts";
import {rewriteDistReqToRootPlugin} from "./vite/rewriteDistReqToRootPlugin.ts";
import {staticFileSyncTransformPlugin} from "./vite/staticFileSyncTransformPlugin.ts";

// https://vitejs.dev/config/

const require = createRequire(import.meta.url);

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        base: "./",
        cacheDir: ".vite_cache",
        resolve: {
            alias: {
                "react/jsx-runtime": "react/jsx-runtime",
                "react/jsx-dev-runtime": "react/jsx-dev-runtime"
            }
        },
        plugins: [
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
            minify: "oxc",
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
