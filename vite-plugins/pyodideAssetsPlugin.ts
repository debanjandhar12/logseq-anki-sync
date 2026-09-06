import {readFile} from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import type {Plugin} from "vite";

const PYODIDE_ASSETS = [
    "pyodide.mjs",
    "pyodide.asm.mjs",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json"
] as const;

export function pyodideAssetsPlugin(): Plugin {
    const pyodideDirectory = path.dirname(
        createRequire(path.join(process.cwd(), "package.json")).resolve("pyodide/package.json")
    );

    return {
        name: "pyodide-assets",
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const assetName = request.url?.match(/^\/pyodide\/([^?]+)(?:\?.*)?$/)?.[1];
                if (!PYODIDE_ASSETS.includes(assetName as (typeof PYODIDE_ASSETS)[number])) {
                    next();
                    return;
                }

                response.setHeader(
                    "Content-Type",
                    assetName.endsWith(".mjs")
                        ? "text/javascript"
                        : assetName.endsWith(".wasm")
                          ? "application/wasm"
                          : assetName.endsWith(".json")
                            ? "application/json"
                            : "application/zip"
                );
                response.end(await readFile(path.join(pyodideDirectory, assetName)));
            });
        },
        async generateBundle() {
            for (const assetName of PYODIDE_ASSETS) {
                this.emitFile({
                    type: "asset",
                    fileName: `pyodide/${assetName}`,
                    source: await readFile(path.join(pyodideDirectory, assetName))
                });
            }
        }
    };
}
