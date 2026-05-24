import path from "node:path";
import type {Plugin} from "vite";

/**
 * Plugin to route Popper/Floating UI imports through shadow-DOM compatibility
 * wrapper while keeping the original packages available through npm aliases.
 */
export function shadowDOMFloatingUIReactPopperBridgePlugin(): Plugin {
    const radixPopperCompatPath = path.resolve(__dirname, "./radixPopperCompat.tsx");
    const floatingUiReactDomCompatPath = path.resolve(__dirname, "./floatingUiReactDomCompat.ts");

    return {
        name: "shadow-dom-react-popper-bridge",
        enforce: "pre",
        resolveId(source) {
            if (source === "@radix-ui/react-popper") {
                return radixPopperCompatPath;
            }

            if (source === "@floating-ui/react-dom") {
                return floatingUiReactDomCompatPath;
            }

            return null;
        }
    };
}
