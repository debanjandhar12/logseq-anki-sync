import path from "node:path";
import type {Plugin} from "vite";

/**
 * Plugin to route Popper/Floating UI imports through shadow-DOM compatibility
 * wrapper while keeping the original packages available through npm aliases.
 */
export function shadowDOMFloatingUIReactPopperBridgePlugin(): Plugin {
    const radixPopperCompatPath = path.resolve(import.meta.dirname, "./radixPopperCompat.tsx");
    const radixPortalCompatPath = path.resolve(import.meta.dirname, "./radixPortalCompat.tsx");
    const floatingUiReactDomCompatPath = path.resolve(
        import.meta.dirname,
        "./floatingUiReactDomCompat.ts"
    );

    return {
        name: "shadow-dom-react-popper-bridge",
        enforce: "pre",
        config() {
            return {
                resolve: {
                    alias: [
                        {
                            find: /^@radix-ui\/react-popper$/,
                            replacement: radixPopperCompatPath
                        },
                        {
                            find: /^@radix-ui\/react-portal$/,
                            replacement: radixPortalCompatPath
                        },
                        {
                            find: /^@floating-ui\/react-dom$/,
                            replacement: floatingUiReactDomCompatPath
                        }
                    ]
                }
            };
        }
    };
}
