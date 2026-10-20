import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect, test, vi} from "vitest";
import useUndo from "../../../../../src/ui/hooks/useUndo";
import type {OcclusionElement} from "../../../../../src/ui/launchers/showOcclusionEditor";
import {useOcclusionCanvasHistory} from "../../../../../src/ui/pages/OcclusionEditor/useOcclusionCanvasHistory";

vi.mock("fabric", () => ({fabric: {}}));
vi.mock("../../../../../src/utils/occlusionUtils", () => ({
    createOcclusionRectEl: (_fabric, left, top, width, height, angle, cId, hint) => ({
        left,
        top,
        angle,
        hint,
        originX: "center",
        _objects: [{}, {text: String(cId)}],
        getScaledWidth: () => width,
        getScaledHeight: () => height,
        calcTransformMatrix() {
            return [1, 0, 0, 1, this.left, this.top];
        },
        setCoords: vi.fn()
    })
}));

import {createOcclusionRectEl} from "../../../../../src/utils/occlusionUtils";

test("actual modification subscription records corrected bounds; undo/redo replay valid snapshots without echo checkpoints", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const initial: OcclusionElement[] = [
        {left: 10, top: 10, width: 20, height: 10, angle: 0, cId: 1}
    ];
    let objects: any[] = [createOcclusionRectEl({}, 10, 10, 20, 10, 0, 1)];
    const listeners = new Map<string, (event: any) => void>();
    const canvas = {
        getObjects: () => objects,
        remove: vi.fn(() => {
            objects = [];
        }),
        add: (obj) => objects.push(obj),
        discardActiveObject: vi.fn(),
        renderAll: vi.fn(),
        on: (name, handler) => listeners.set(name, handler),
        off: (name, handler) => {
            if (listeners.get(name) === handler) listeners.delete(name);
        }
    };
    const fabricRef = {current: canvas};
    const image = Object.assign(document.createElement("img"), {width: 100, height: 100});
    let state: ReturnType<typeof useUndo<OcclusionElement[]>>;
    let save: () => void;
    function Harness() {
        state = useUndo(initial);
        save = useOcclusionCanvasHistory(fabricRef, image, state[0].present, state[1].set, true);
        return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(<Harness />));
        const original = objects[0];
        await act(async () => {
            original.left = 9;
            listeners.get("object:modified")!({target: original});
        });
        expect(state[0].present[0].left).toBe(10);
        expect(state[0].past).toHaveLength(1);
        expect(objects[0]).toBe(original); // Own checkpoint must not rebuild the canvas.
        await act(async () => {
            original.left = 30;
            save();
        });
        expect(state[0].past).toHaveLength(2);
        await act(async () => state[1].undo());
        expect(objects[0].left).toBe(10);
        expect(state[0].past).toHaveLength(1);
        await act(async () => state[1].redo());
        expect(objects[0].left).toBe(30);
        expect(state[0].past).toHaveLength(2);
    } finally {
        await act(async () => root.unmount());
        expect(listeners.size).toBe(0);
        vi.unstubAllGlobals();
    }
});
