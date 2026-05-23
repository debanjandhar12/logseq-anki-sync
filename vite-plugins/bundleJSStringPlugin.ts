import * as path from "path";
import { context } from "esbuild";

export function bundleJSStringPlugin(mode: string) {
    return {
        name: "bundleJSStringPlugin",
        async transform(code, id) {
            if (id.endsWith(".js?string")) {
                const isProd = mode === "production";
                const testLogLevel = process.env.VITE_TEST_LOG_LEVEL;
                const ctx = await context({
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
                const result = await ctx.rebuild();
                await ctx.dispose();
                return {
                    code: `export default ${JSON.stringify(result.outputFiles[0].text)};`,
                    map: null,
                };
            }
        },
    };
}