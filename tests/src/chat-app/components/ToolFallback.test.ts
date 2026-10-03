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

async function renderTrigger(
    status: Parameters<typeof ToolFallback.Trigger>[0]["status"],
    isError = false
) {
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
                    status,
                    isError
                })
            )
        );
    });
    return container;
}

describe("ToolFallback trigger", () => {
    test.each<{
        status: Parameters<typeof ToolFallback.Trigger>[0]["status"];
        colorClass: string;
    }>([
        {status: {type: "running"}, colorClass: "text-current"},
        {status: {type: "complete"}, colorClass: "text-success"},
        {status: undefined, colorClass: "text-success"},
        {status: {type: "incomplete", reason: "error"}, colorClass: "text-danger"},
        {
            status: {type: "requires-action", reason: "interrupt"},
            colorClass: "text-current"
        },
        {
            status: {type: "incomplete", reason: "cancelled"},
            colorClass: "text-muted-foreground"
        }
    ])("uses $colorClass for status $status", async ({status, colorClass}) => {
        const container = await renderTrigger(status);
        const icon = container.querySelector('[data-slot="tool-fallback-trigger-icon"]');

        expect(icon?.classList.contains(colorClass)).toBe(true);
    });

    test("uses the error color instead of the completed tool color for failed results", async () => {
        const container = await renderTrigger({type: "complete"}, true);
        const icon = container.querySelector('[data-slot="tool-fallback-trigger-icon"]');

        expect(icon?.getAttribute("aria-label")).toBe("Tool failed");
        expect(icon?.classList.contains("text-danger")).toBe(true);
        expect(icon?.classList.contains("text-success")).toBe(false);
    });

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
