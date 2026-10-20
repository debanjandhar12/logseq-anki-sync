import {act, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {HighlightMaskEditorComponent} from "../../../../src/ui/pages/HighlightMaskEditor";
import {OcclusionEditorComponent} from "../../../../src/ui/pages/OcclusionEditor";

const state = vi.hoisted(() => ({canvas: null as any, image: null as HTMLImageElement | null}));
vi.mock("../../../../src/ui/UI", () => ({
    UI: {getActiveModal: () => "editor", hideModal: vi.fn()}
}));
vi.mock("../../../../src/ui/launchers/showConfirmModal", () => ({
    showConfirmModal: vi.fn().mockResolvedValue(true)
}));
vi.mock("../../../../src/ui/launchers/showInputModal", () => ({
    showInputModal: vi.fn().mockResolvedValue(null)
}));
vi.mock("../../../../src/ui/modals/core/Modal", () => ({
    Modal: ({children}: {children: ReactNode}) => <div>{children}</div>
}));
vi.mock("../../../../src/ui/modals/core/ModalHeader", () => ({
    ModalHeader: ({children}: {children: ReactNode}) => <header>{children}</header>
}));
vi.mock("../../../../src/ui/modals/core/ModalFooter", () => ({
    DialogModalFooter: ({onConfirm}) => (
        <button type="button" onClick={onConfirm}>
            Save
        </button>
    )
}));
vi.mock("../../../../src/ui/pages/HighlightMaskEditor/HighlightMaskToolbar", () => ({
    HighlightMaskToolbar: ({setTags}) => (
        <button type="button" onClick={() => setTags(["hide-all-test-one"])}>
            Change tags
        </button>
    )
}));
vi.mock("../../../../src/ui/pages/OcclusionEditor/OcclusionToolbar", () => ({
    OcclusionToolbar: ({setTags}) => (
        <button type="button" onClick={() => setTags(["hide-all-test-one"])}>
            Change tags
        </button>
    )
}));
vi.mock("../../../../src/logseq/WindowParentBridge", () => ({
    WindowParentBridge: {makeAssetUrl: vi.fn()}
}));
vi.mock("../../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {
        createElement: () =>
            (state.image = Object.assign(document.createElement("img"), {width: 100, height: 100})),
        getElementById: () => null,
        getBody: () => document.body,
        addDocumentEventListener: (...args: Parameters<Document["addEventListener"]>) =>
            document.addEventListener(...args),
        removeDocumentEventListener: (...args: Parameters<Document["removeEventListener"]>) =>
            document.removeEventListener(...args)
    }
}));
vi.mock("../../../../src/utils/occlusionUtils", () => ({
    updateOcclusionHint: vi.fn(),
    createOcclusionRectEl: (_fabric, left, top, width, height, angle, cId, hint) => ({
        left,
        top,
        angle,
        hint,
        originX: "center",
        _objects: [
            {},
            {
                text: String(cId),
                set(key, value) {
                    this[key] = value;
                }
            }
        ],
        getScaledWidth: () => width,
        getScaledHeight: () => height,
        calcTransformMatrix() {
            return [1, 0, 0, 1, this.left, this.top];
        },
        setCoords: vi.fn()
    })
}));
vi.mock("fabric", () => ({
    fabric: {
        Group: class {},
        Image: class {},
        Canvas: class {
            objects: any[] = [];
            active: any = null;
            listeners = new Map<string, Set<(event: any) => void>>();
            constructor() {
                state.canvas = this;
            }
            on(name, handler) {
                if (!this.listeners.has(name)) this.listeners.set(name, new Set());
                this.listeners.get(name)!.add(handler);
            }
            off(name, handler) {
                this.listeners.get(name)?.delete(handler);
            }
            fire(name, event = {}) {
                this.listeners.get(name)?.forEach((handler) => handler(event));
            }
            getObjects() {
                return this.objects;
            }
            getActiveObject() {
                return this.active;
            }
            getActiveObjects() {
                return this.active ? [this.active] : [];
            }
            setActiveObject(obj) {
                this.active = obj;
                this.fire("selection:created");
            }
            discardActiveObject() {
                this.active = null;
                this.fire("selection:cleared");
            }
            add(obj) {
                this.objects.push(obj);
            }
            remove(...removed) {
                this.objects = this.objects.filter((obj) => !removed.includes(obj));
            }
            forEachObject(callback) {
                this.objects.forEach(callback);
            }
            setZoom() {}
            setWidth() {}
            setHeight() {}
            setBackgroundImage() {}
            renderAll() {}
            dispose() {}
        }
    }
}));
vi.mock("tesseract.js", () => ({createWorker: vi.fn(), PSM: {SPARSE_TEXT: 11}}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function press(key: string) {
    await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", {key, cancelable: true}))
    );
}

test("real highlight component confirms with Enter immediately after Tiptap initialization", async () => {
    const resolve = vi.fn();
    await act(async () =>
        root.render(
            <HighlightMaskEditorComponent
                rawText={"<raw>\ntext"}
                highlightElements={[]}
                highlightConfig={{}}
                blockTags={[]}
                resolve={resolve}
                reject={vi.fn()}
                modalContext={{modalId: "editor"}}
            />
        )
    );
    expect(container.querySelector(".tiptap")?.textContent).toBe("<raw>\ntext");
    await press("Enter");
    expect(resolve).toHaveBeenCalledWith({config: {}, elements: [], tags: []});
});

test("real highlight component saves tag-only edits using keyboard confirmation", async () => {
    const resolve = vi.fn();
    await act(async () =>
        root.render(
            <HighlightMaskEditorComponent
                rawText="text"
                highlightElements={[]}
                highlightConfig={{}}
                blockTags={[]}
                resolve={resolve}
                reject={vi.fn()}
                modalContext={{modalId: "editor"}}
            />
        )
    );
    await act(async () => container.querySelector("button")!.click());
    await press("Enter");
    expect(resolve).toHaveBeenCalledWith({config: {}, elements: [], tags: ["hide-all-test-one"]});
});

test("real occlusion component saves tag-only changes and updates a newly selected c1 using the first numeric shortcut", async () => {
    const resolve = vi.fn();
    await act(async () =>
        root.render(
            <OcclusionEditorComponent
                imgURL="https://example.com/image.png"
                occlusionElements={[{left: 20, top: 20, width: 20, height: 10, angle: 0, cId: 1}]}
                occlusionConfig={{}}
                blockTags={[]}
                resolve={resolve}
                reject={vi.fn()}
                modalContext={{modalId: "editor"}}
            />
        )
    );
    const canvas = state.canvas;
    await act(async () => {
        state.image!.onload!(new Event("load"));
    });
    await act(async () => canvas.setActiveObject(canvas.getObjects()[0]));
    await press("2");
    expect(canvas.getObjects()[0]._objects[1].text).toBe("2");
    await act(async () => container.querySelector("button")!.click());
    await press("Enter");
    expect(resolve).toHaveBeenCalledWith({
        config: {},
        elements: [{left: 20, top: 20, width: 20, height: 10, angle: 0, cId: 2}],
        tags: ["hide-all-test-one"]
    });
});
