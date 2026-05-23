import type {Plugin} from "vite";
import path from "path";

/**
 * Plugin to ensure all React imports use the same instance.
 *
 * This plugin redirects react imports to React.ts / ReactDOM.ts / ReactJsxRuntime.ts.
 * Those files, in turn, attempt to use logseq's React if available in production mode.
 */
export function logseqReactBridgePlugin(): Plugin {
    const reactWrapperPath = path.resolve(__dirname, "./React.ts");
    const reactDOMWrapperPath = path.resolve(__dirname, "./ReactDOM.ts");
    const jsxRuntimeWrapperPath = path.resolve(__dirname, "./ReactJsxRuntime.ts");

    function isReactDomInternal(importer: string | undefined): boolean {
        if (!importer) return false;
        return /node_modules[/\\](.pnpm[/\\].*[/\\]node_modules[/\\])?react-dom[/\\]/.test(importer);
    }

    return {
        name: "react-unification",
        enforce: "pre",
        resolveId(source, importer) {
            // --- react ---
            // Intercept all "react" imports EXCEPT from React.ts itself.
            if (source === "react" &&
                importer &&
                !importer.endsWith("/logseqReactBridgePlugin/React.ts")) {
                return reactWrapperPath;
            }

            // --- react-dom and react-dom/client ---
            // Intercept from our code and third-party libs, but NOT from
            // within react-dom/ itself (to prevent circular deps).
            if ((source === "react-dom" || source === "react-dom/client") &&
                importer &&
                !importer.endsWith("/logseqReactBridgePlugin/ReactDOM.ts") &&
                !isReactDomInternal(importer)) {
                return reactDOMWrapperPath;
            }

            // --- react/jsx-runtime and react/jsx-dev-runtime ---
            if ((source === "react/jsx-runtime" || source === "react/jsx-dev-runtime") &&
                importer &&
                !importer.endsWith("/logseqReactBridgePlugin/ReactJsxRuntime.ts")) {
                return jsxRuntimeWrapperPath;
            }

            return null;
        }
    };
}
