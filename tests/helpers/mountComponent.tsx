import type React from "react";
import {act} from "react";
import {createRoot, type Root} from "react-dom/client";

export function mountComponent(component: React.ReactElement): {
    container: HTMLElement;
    root: Root;
    unmount: () => Promise<void>;
} {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(component);
    return {
        container,
        root,
        unmount: async () => {
            await act(async () => root.unmount());
            container.remove();
        }
    };
}
