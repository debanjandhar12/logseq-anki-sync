import {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {useHighlightMaskKeyboard} from "../../../../src/ui/pages/HighlightMaskEditor/useHighlightMaskKeyboard";
import {useOcclusionKeyboard} from "../../../../src/ui/pages/OcclusionEditor/useOcclusionKeyboard";

const state = vi.hoisted(() => ({activeModal: "editor"}));
vi.mock("../../../../src/ui/UI", () => ({UI: {getActiveModal: () => state.activeModal}}));
vi.mock("../../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {
        addDocumentEventListener: (...args: Parameters<Document["addEventListener"]>) =>
            document.addEventListener(...args),
        removeDocumentEventListener: (...args: Parameters<Document["removeEventListener"]>) =>
            document.removeEventListener(...args)
    }
}));
vi.mock("fabric", () => ({fabric: {ActiveSelection: class {}}}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    state.activeModal = "editor";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

function press(key: string, options: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {key, cancelable: true, ...options});
    document.dispatchEvent(event);
    return event;
}

test("highlight keyboard uses initialized/current confirmation and selection callbacks", async () => {
    const initialConfirm = vi.fn();
    const confirm = vi.fn();
    const changeClozeId = vi.fn();
    const cancel = vi.fn();
    const selectElement = vi.fn();
    const undo = vi.fn();
    const redo = vi.fn();
    const deleteHighlight = vi.fn();
    function Harness({ready, selected}: {ready: boolean; selected: number | null}) {
        useHighlightMaskKeyboard({
            open: true,
            modalId: "editor",
            selectedElementIndex: selected,
            selectElement,
            canUndo: true,
            canRedo: true,
            undo,
            redo,
            confirm: ready ? confirm : initialConfirm,
            cancel,
            deleteHighlight,
            changeClozeId
        });
        return null;
    }
    await act(async () => root.render(<Harness ready={false} selected={null} />));
    // Editor initialization or tag changes must refresh confirmation without an element edit.
    await act(async () => root.render(<Harness ready={true} selected={null} />));
    expect(press("Enter").defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    expect(initialConfirm).not.toHaveBeenCalled();
    expect(press("Enter", {shiftKey: true}).defaultPrevented).toBe(false);
    await act(async () => root.render(<Harness ready={true} selected={0} />));
    press("2");
    expect(changeClozeId).toHaveBeenCalledWith("2");
    press("Delete");
    expect(deleteHighlight).toHaveBeenCalledOnce();
    press("Escape");
    expect(selectElement).toHaveBeenCalledWith(null);
    expect(cancel).not.toHaveBeenCalled();
    press("z", {ctrlKey: true});
    press("Z", {ctrlKey: true, shiftKey: true});
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();
    state.activeModal = "nested-hint";
    expect(press("Enter").defaultPrevented).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    state.activeModal = "editor";
    press("Enter");
    expect(confirm).toHaveBeenCalledOnce();
    root = createRoot(container);
});

test("occlusion keyboard refreshes tag confirmation and immediate cloze selection changes", async () => {
    const firstConfirm = vi.fn();
    const latestConfirm = vi.fn();
    const firstCloze = vi.fn();
    const latestCloze = vi.fn();
    const activeObject = {left: 10, top: 10};
    const canvas = {
        getActiveObject: () => activeObject,
        getActiveObjects: () => [activeObject],
        fire: vi.fn()
    };
    const fabricRef = {current: canvas};
    const noop = vi.fn();
    function Harness({updated}: {updated: boolean}) {
        useOcclusionKeyboard({
            open: true,
            modalId: "editor",
            fabricRef,
            activeTool: "select",
            canUndo: false,
            canRedo: false,
            undo: noop,
            redo: noop,
            confirm: updated ? latestConfirm : firstConfirm,
            cancel: noop,
            addOcclusion: noop,
            deleteOcclusion: noop,
            changeClozeId: updated ? latestCloze : firstCloze
        });
        return null;
    }
    await act(async () => root.render(<Harness updated={false} />));
    await act(async () => root.render(<Harness updated={true} />));
    press("Enter");
    press("2");
    expect(latestConfirm).toHaveBeenCalledOnce();
    expect(latestCloze).toHaveBeenCalledWith("2");
    expect(firstConfirm).not.toHaveBeenCalled();
    expect(firstCloze).not.toHaveBeenCalled();
    expect(press("ArrowLeft").defaultPrevented).toBe(true);
    expect(activeObject.left).toBe(9);
    expect(canvas.fire).toHaveBeenCalledExactlyOnceWith("object:modified", {target: activeObject});
    state.activeModal = "nested";
    expect(press("2").defaultPrevented).toBe(false);
    expect(latestCloze).toHaveBeenCalledOnce();
});

test("occlusion arrows leave scrolling to the modal when nothing is selected", async () => {
    const noop = vi.fn();
    const fabricRef = {current: {getActiveObject: () => null}};
    function Harness() {
        useOcclusionKeyboard({
            open: true,
            modalId: "editor",
            fabricRef,
            activeTool: "select",
            canUndo: false,
            canRedo: false,
            undo: noop,
            redo: noop,
            confirm: noop,
            cancel: noop,
            addOcclusion: noop,
            deleteOcclusion: noop,
            changeClozeId: noop
        });
        return null;
    }
    await act(async () => root.render(<Harness />));
    expect(press("ArrowDown").defaultPrevented).toBe(false);
});
