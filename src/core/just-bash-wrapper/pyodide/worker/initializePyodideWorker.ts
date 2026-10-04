import type {PyodideInterface} from "pyodide";
import {VIR_ENV_HOSTNAME, VIR_ENV_USER, VIR_ENV_USER_PATH} from "../../../../constants";
import {createPythonGlobals} from "./createPythonGlobals";

const PACKAGE_BASE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";

export interface PyodideWorkerRuntime {
    pyodide: PyodideInterface;
    originalFetch: typeof globalThis.fetch;
    allowedLocalAssetUrls: ReadonlySet<string>;
    capabilities: ReturnType<typeof createPythonGlobals>;
}

export async function initializePyodideWorker(
    runtimeBaseUrl: string
): Promise<PyodideWorkerRuntime> {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const baseUrl = new URL(runtimeBaseUrl);
    baseUrl.pathname = baseUrl.pathname.replace(/\/?$/, "/");
    const allowedLocalAssetUrls = new Set([
        new URL("pyodide.asm.wasm", baseUrl).href,
        new URL("python_stdlib.zip", baseUrl).href
    ]);
    const capabilities = createPythonGlobals();
    const {loadPyodide} = (await import(
        /* @vite-ignore */ new URL("pyodide.mjs", baseUrl).href
    )) as typeof import("pyodide");
    const pyodide = await loadPyodide({
        indexURL: baseUrl.href,
        packageBaseUrl: PACKAGE_BASE_URL,
        env: {
            HOME: VIR_ENV_USER_PATH,
            USER: VIR_ENV_USER,
            LOGNAME: VIR_ENV_USER,
            HOSTNAME: VIR_ENV_HOSTNAME
        },
        // Startup output is not part of a command result; execution installs capture.
        stdout: () => {},
        stderr: () => {},
        jsglobals: capabilities.globals
    });
    return {pyodide, originalFetch, allowedLocalAssetUrls, capabilities};
}
