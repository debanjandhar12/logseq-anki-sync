import reactPlugin from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import logseqDevPlugin from "vite-plugin-logseq";
import {nodePolyfills} from "vite-plugin-node-polyfills";
import * as path from "path";
import * as fs from "fs";
const {parseSync, traverse} = require("@babel/core");
const generate = require("@babel/generator").default;
import {build} from "esbuild";
// https://vitejs.dev/config/

function staticFileSyncTransformPlugin() {
    return {
        name: "staticFileSyncTransformPlugin",
        enforce: "pre" as const,
        transform(code, id) {
            if (!/\.(js|ts|tsx|jsx|mjs)(\?.*)?$/.test(id) || !code.includes("readFileSync")) {
                return null;
            }
            let curDir = path.dirname(id);
            if (curDir.includes("node_modules/.vite")) {
                // We are in a vite cache folder. We need original path.
                curDir = path.join(
                    __dirname,
                    "/node_modules/",
                    path.parse(path.basename(id)).name,
                );
            }
            const ast = parseSync(code, {sourceType: "module"});
            traverse(ast, {
                Identifier(nodePath) {
                    if (nodePath.node.name === "__dirname") {
                        nodePath.replaceWithSourceString(JSON.stringify(curDir));
                    }
                },
            });
            traverse(ast, {
                CallExpression(nodePath) {
                    const {callee, arguments: args} = nodePath.node;
                    if (
                        callee.type === "MemberExpression" &&
                        callee.object.name === "path" &&
                        callee.property.name === "join"
                    ) {
                        nodePath.replaceWithSourceString(
                            JSON.stringify(path.join(...args.map((arg) => arg.value))),
                        );
                    }
                },
            });
            traverse(ast, {
                CallExpression(nodePath) {
                    const {callee, arguments: args} = nodePath.node;
                    if (
                        callee.type === "MemberExpression" &&
                        callee.object.name === "fs" &&
                        callee.property.name === "readFileSync"
                    ) {
                        const filePath = args[0].value;
                        try {
                            const fileContents = fs.readFileSync(filePath, "utf-8");
                            nodePath.replaceWithSourceString(JSON.stringify(fileContents));
                        } catch (e) {
                            console.error(e);
                        }
                    }
                },
            });
            const generated = generate(ast, {retainLines: true});
            code = generated.code;
            const map = generated.map;
            return {code, map};
        },
    };
}

function bundleJSStringPlugin(mode: string) {
    return {
        name: "bundleJSStringPlugin",
        async transform(code, id) {
            if (id.endsWith(".js?string")) {
                const isProd = mode === "production";
                const testLogLevel = process.env.VITE_TEST_LOG_LEVEL;
                const result = await build({
                    stdin: {
                        contents: code,
                        resolveDir: path.dirname(id),
                        sourcefile: id,
                    },
                    sourceRoot: __dirname,
                    bundle: true,
                    minify: true,
                    //format: 'cjs',
                    platform: "browser",
                    write: false,
                    loader: {
                        ".css": "empty", // Ignore CSS imports in bundled JS strings
                    },
                    define: {
                        "import.meta.env.PROD": JSON.stringify(isProd),
                        "import.meta.env.MODE": JSON.stringify(mode),
                        "import.meta.env.VITEST": JSON.stringify(mode === "test"),
                        "import.meta.env.VITE_TEST_LOG_LEVEL": testLogLevel
                            ? JSON.stringify(testLogLevel)
                            : "undefined",
                    },
                });
                return {
                    code: `export default ${JSON.stringify(result.outputFiles[0].text)};`,
                    map: null,
                };
            }
        },
    };
}

export default defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        base: "./",
        cacheDir: ".vite_cache",
        plugins: [
            mode === "development" && logseqDevPlugin(), // for dev only
            mode === "development" && reactPlugin(), // for dev only
            nodePolyfills(),
            staticFileSyncTransformPlugin(),
            bundleJSStringPlugin(mode),
        ],
        define: {
            "process.env": JSON.stringify({...env, NODE_ENV: mode}),
        },
        server: {
            port: 5173,
            cors: true,
            watch: {
                ignored: ["**/dist/**", "**/node_modules/**"],
            },
        },
        build: {
            sourcemap: true,
            target: "modules",
            minify: "esbuild",
            emptyOutDir: true,
        },
        css: {
            postcss: {
                plugins: [require("tailwindcss"), require("autoprefixer")],
            },
        },
        test: {
            include: ["**/*.test.ts"],
            exclude: ["**/logseq-dev-plugin/**", "**/node_modules/**"],
            setupFiles: ["./tests/setup.ts"],
            // todo: why alias?
            alias: {
                "@logseq/libs": "sass",
            },
            environment: "jsdom",
            env: {...env, NODE_ENV: mode},
            pool: "forks",
            poolOptions: {
                forks: {
                    singleFork: true,
                },
            },
            fileParallelism: false,
        },
    };
});
