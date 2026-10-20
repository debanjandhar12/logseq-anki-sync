import React, {useState} from "react";
import {jsx} from "react/jsx-runtime";
import {createPortal, flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import {describe, expect, test} from "vitest";

describe("Logseq React bridge", () => {
    test("shares hooks and the automatic JSX runtime with ReactDOM", () => {
        const container = document.createElement("div");
        const portalContainer = document.createElement("div");
        const root = createRoot(container);

        function Counter() {
            const [count, setCount] = useState(0);
            return React.createElement(
                React.Fragment,
                null,
                jsx("button", {onClick: () => setCount(count + 1), children: count}),
                createPortal(jsx("span", {children: "portal"}), portalContainer)
            );
        }

        try {
            flushSync(() => root.render(jsx(Counter, {})));
            expect(container.querySelector("button")?.textContent).toBe("0");
            flushSync(() => container.querySelector("button")?.click());
            expect(container.querySelector("button")?.textContent).toBe("1");
            expect(portalContainer.textContent).toBe("portal");
        } finally {
            flushSync(() => root.unmount());
        }
        expect(container.textContent).toBe("");
        expect(portalContainer.textContent).toBe("");
    });
});
