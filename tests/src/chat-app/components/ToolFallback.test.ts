import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, test} from "vitest";
import {ToolFallback} from "../../../../src/chat-app/components/ToolFallback";

const mountedRoots: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
}> = [];

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderTrigger(status: Parameters<typeof ToolFallback.Trigger>[0]["status"]) {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});

    await act(async () => {
        root.render(
            createElement(
                ToolFallback.Root,
                null,
                createElement(ToolFallback.Trigger, {
                    toolName: "test_tool",
                    status
                })
            )
        );
    });
    return container;
}

describe("ToolFallback trigger", () => {
    test("shows its circular animation and shimmer while running", async () => {
        const container = await renderTrigger({type: "running"});
        const icon = container.querySelector('[data-slot="tool-fallback-trigger-icon"]');

        expect(icon?.getAttribute("aria-label")).toBe("Tool is running");
        expect(icon?.classList.contains("animate-spin")).toBe(true);
        expect(
            container.querySelector('[data-slot="tool-fallback-trigger-shimmer"]')
        ).not.toBeNull();
    });

    test("keeps required user action distinct from execution", async () => {
        const container = await renderTrigger({type: "requires-action", reason: "interrupt"});
        const icon = container.querySelector('[data-slot="tool-fallback-trigger-icon"]');

        expect(icon?.getAttribute("aria-label")).toBe("Tool requires user action");
        expect(icon?.classList.contains("animate-spin")).toBe(false);
        expect(container.querySelector('[data-slot="tool-fallback-trigger-shimmer"]')).toBeNull();
    });
});
