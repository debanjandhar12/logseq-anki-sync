import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import {playwright} from "@vitest/browser-playwright";
import {defineConfig, loadEnv} from "vite";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import {bundleJSStringPlugin} from "./vite-plugins/bundleJSStringPlugin.ts";
import {inlineSkillFilePlugin} from "./vite-plugins/inlineSkillFilePlugin.ts";
import {logseqDevPlugin} from "./vite-plugins/logseqDevPlugin.ts";
import {logseqReactBridgePlugin} from "./vite-plugins/logseqReactBridgePlugin/index.ts";
import {pyodideAssetsPlugin} from "./vite-plugins/pyodideAssetsPlugin.ts";
import {rewriteDistReqToRootPlugin} from "./vite-plugins/rewriteDistReqToRootPlugin.ts";
import {shadowDOMFloatingUIReactPopperBridgePlugin} from "./vite-plugins/shadowDOMFloatingUIReactPopperBridgePlugin/index.ts";
import {staticFileSyncTransformPlugin} from "./vite-plugins/staticFileSyncTransformPlugin.ts";
import {stripUseClientDirectivePlugin} from "./vite-plugins/stripUseClientDirectivePlugin.ts";

// https://vitejs.dev/config/

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const createBrowserTestConfig = () => ({
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
                {
                    browser: "chromium" as const,
                    viewport: {width: 1280, height: 720}
                }
            ],
            screenshotFailures: false,
            trace: {
                mode: "retain-on-failure" as const,
                tracesDir: ".vitest/traces"
            }
        },
        server: {
            deps: {
                inline: [/@floating-ui/]
            }
        }
    });
    return {
        base: "./",
        cacheDir: ".vite_cache",
        resolve: {
            dedupe: ["react", "react-dom"],
            alias: {
                // Required for src/ imports used in shadcn
                src: path.resolve(import.meta.dirname, "./src")
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
            proxy: Object.fromEntries(
                [
                    "cdn.jsdelivr.net",
                    "files.pythonhosted.org",
                    "i0.hdslb.com",
                    "pypi.org",
                    "www.youtube.com"
                ].map((host) => [
                    `/__logseq_http_proxy/${host}`,
                    {
                        target: `https://${host}`,
                        changeOrigin: true,
                        rewrite: (requestPath: string) =>
                            requestPath.slice(`/__logseq_http_proxy/${host}`.length) || "/",
                        configure: (proxy: {
                            on(
                                event: "proxyReq",
                                listener: (request: {removeHeader(name: string): void}) => void
                            ): void;
                        }) => {
                            proxy.on("proxyReq", (request) => {
                                request.removeHeader("cookie");
                                request.removeHeader("origin");
                                request.removeHeader("referer");
                            });
                        }
                    }
                ])
            ),
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
                        ...createBrowserTestConfig(),
                        include: [
                            "tests/src/chat-app/prompts/**/*.test.{ts,tsx}",
                            "tests/src/chat-app/prompts/**/*.test.e2e.{ts,tsx}"
                        ]
                    }
                },
                {
                    test: {
                        name: "e2e",
                        ...createBrowserTestConfig(),
                        include: ["tests/**/*.e2e.test.{ts,tsx}"],
                        exclude: ["tests/src/chat-app/prompts/**"]
                    }
                }
            ]
        }
    };
});
