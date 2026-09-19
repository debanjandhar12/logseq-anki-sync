import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import {playwright} from "@vitest/browser-playwright";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite-plugins/bundleJSStringPlugin";
import {inlineSkillFilePlugin} from "./vite-plugins/inlineSkillFilePlugin";
import {logseqDevPlugin} from "./vite-plugins/logseqDevPlugin";
import {logseqReactBridgePlugin} from "./vite-plugins/logseqReactBridgePlugin";
import {pyodideAssetsPlugin} from "./vite-plugins/pyodideAssetsPlugin";
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
            pyodideAssetsPlugin(),
            inlineSkillFilePlugin(),
            stripUseClientDirectivePlugin(),
            logseqReactBridgePlugin(), // Must be first to intercept React imports
            shadowDOMFloatingUIReactPopperBridgePlugin(),
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
                "vite-plugin-node-polyfills/shims/global",
                "@radix-ui/react-popper-original",
                "@radix-ui/react-portal-original"
            ]
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
        worker: {
            format: "es"
        },
        test: {
            exclude: ["**/logseq-dev-plugin/**", "**/node_modules/**"],
            expect: {
                poll: {
                    timeout: 10_000
                }
            },
            setupFiles: ["./tests/setup.ts"],
            env: {...env, NODE_ENV: mode},
            fileParallelism: true,
            sequence: {
                concurrent: false
            },
            projects: [
                {
                    test: {
                        name: "unit",
                        environment: "jsdom",
                        include: [
                            "tests/**/*.test.{ts,tsx}",
                            "!tests/**/*.e2e.test.{ts,tsx}",
                            "!tests/src/chat-app/prompts/**"
                        ]
                    }
                },
                {
                    test: {
                        name: "prompts",
                        environment: "jsdom",
                        include: [
                            "tests/src/chat-app/prompts/**/*.test.{ts,tsx}",
                            "tests/src/chat-app/prompts/**/*.test.e2e.{ts,tsx}"
                        ]
                    }
                },
                {
                    test: {
                        name: "e2e",
                        include: ["tests/**/*.e2e.test.{ts,tsx}"],
                        browser: {
                            enabled: true,
                            headless: true,
                            provider: playwright(),
                            instances: [
                                {
                                    browser: "chromium",
                                    viewport: {width: 1280, height: 720}
                                }
                            ],
                            screenshotFailures: false,
                            trace: "retain-on-failure"
                        },
                        server: {
                            deps: {
                                inline: [/@floating-ui/]
                            }
                        }
                    }
                }
            ]
        }
    };
});
