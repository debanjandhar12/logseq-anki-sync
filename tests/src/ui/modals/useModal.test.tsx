import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, expect, test, vi} from "vitest";
import {useModal} from "../../../../src/ui/modals/hooks/useModal";

vi.mock("../../../../src/ui/UI", () => ({UI: {getActiveModal: () => "test-modal"}}));
vi.mock("../../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {
        getElementById: (id: string) => document.getElementById(id),
        getBody: () => document.body,
        addDocumentEventListener: (...args: Parameters<Document["addEventListener"]>) =>
            document.addEventListener(...args),
        removeDocumentEventListener: (...args: Parameters<Document["removeEventListener"]>) =>
            document.removeEventListener(...args)
    }
}));

afterEach(() => vi.unstubAllGlobals());

test.each([
    true,
    false,
    undefined
])("arrow scrolling is configurable: %s", async (enableArrowKeyScroll) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    container.id = "test-modal";
    document.body.append(container);
    const root = createRoot(container);
    function Harness() {
        useModal(vi.fn(), {modalId: container.id, enableArrowKeyScroll});
        return <div className="overflow-y-auto" />;
    }
    try {
        await act(async () => root.render(<Harness />));
        const scroller = container.firstElementChild;
        Object.defineProperty(scroller, "scrollHeight", {value: 500});
        Object.defineProperty(scroller, "clientHeight", {value: 100});
        const down = new KeyboardEvent("keydown", {key: "ArrowDown", cancelable: true});
        document.dispatchEvent(down);
        expect(scroller.scrollTop).toBe(enableArrowKeyScroll === false ? 0 : 50);
        expect(down.defaultPrevented).toBe(enableArrowKeyScroll !== false);
        document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowUp"}));
        expect(scroller.scrollTop).toBe(0);
    } finally {
        await act(async () => root.unmount());
        container.remove();
    }
});
