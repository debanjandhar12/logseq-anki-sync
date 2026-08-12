import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {describe, expect, test, vi} from "vitest";
import {
    isThreadPageExportEnabled,
    ThreadTopToolBarMore
} from "../../../../src/chat-app/components/ThreadTopToolBar";

describe("ThreadTopToolBar", () => {
    test.each([
        ["new", undefined, 0, false, false],
        ["new", "thread-1", 1, false, false],
        ["regular", undefined, 1, false, false],
        ["regular", "thread-1", 0, false, false],
        ["regular", "thread-1", 1, false, true],
        ["regular", "thread-1", 1, true, false],
        ["deleted", "thread-1", 1, false, false]
    ])("checks status=%s, id=%s, messages=%i, busy=%s", (status, threadId, messageCount, isBusy, expected) => {
        expect(
            isThreadPageExportEnabled(status as string, threadId as string, messageCount, isBusy)
        ).toBe(expected);
    });

    test("closes the non-modal more menu after an outside pointer interaction", async () => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement("div");
        const outside = document.createElement("button");
        document.body.append(container, outside);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                createElement(ThreadTopToolBarMore, {
                    onOpenDevTools: vi.fn(),
                    onExportAsPage: vi.fn(),
                    isPageExportDisabled: false
                })
            );
        });

        const trigger = container.querySelector("button");
        expect(trigger).not.toBeNull();
        await act(async () => {
            trigger?.dispatchEvent(
                new MouseEvent("pointerdown", {bubbles: true, button: 0, ctrlKey: false})
            );
        });
        expect(document.body.textContent).toContain("Export as Page");

        await new Promise((resolve) => setTimeout(resolve, 0));
        await act(async () => {
            outside.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true}));
        });
        expect(document.body.textContent).not.toContain("Export as Page");

        await act(async () => {
            root.unmount();
        });
        container.remove();
        outside.remove();
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    });
});
