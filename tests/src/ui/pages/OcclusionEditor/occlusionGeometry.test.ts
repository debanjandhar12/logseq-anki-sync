import {describe, expect, test, vi} from "vitest";
import {serializeOcclusionElements} from "../../../../../src/ui/pages/OcclusionEditor/serializeOcclusionElements";
import {commitOcclusionModification} from "../../../../../src/ui/pages/OcclusionEditor/utils/commitOcclusionModification";
import {constrainOcclusionBounds} from "../../../../../src/ui/pages/OcclusionEditor/utils/constrainOcclusionBounds";

function object(overrides = {}) {
    return {
        left: -1,
        top: 150,
        angle: 0,
        originX: "center",
        getScaledWidth: () => 20,
        getScaledHeight: () => 10,
        calcTransformMatrix() {
            return [1, 0, 0, 1, this.left, this.top];
        },
        setCoords: vi.fn(),
        ...overrides
    };
}

describe("occlusion bounds and checkpoints", () => {
    test("corrects bounds before serializing a single history checkpoint", () => {
        const obj = object();
        const snapshots: ReturnType<typeof serializeOcclusionElements>[] = [];
        const save = vi.fn(() => snapshots.push(serializeOcclusionElements([obj])));
        const render = vi.fn();
        commitOcclusionModification(obj, {width: 100, height: 100}, save, render);
        expect(snapshots[0][0]).toMatchObject({left: 10, top: 95});
        expect(save).toHaveBeenCalledOnce();
        expect(obj.setCoords).toHaveBeenCalledOnce();
        expect(render).toHaveBeenCalledOnce();
        // A later change leaves a valid snapshot for undo and redo to restore.
        obj.left = 30;
        commitOcclusionModification(obj, {width: 100, height: 100}, save, render);
        expect(snapshots.map((snapshot) => snapshot[0].left)).toEqual([10, 30]);
    });
    test("uses the rotated scene bounds for centered groups", () => {
        const obj = object({angle: 90});
        constrainOcclusionBounds(obj, {width: 100, height: 100});
        expect(obj.left).toBeCloseTo(5);
        expect(obj.top).toBeCloseTo(90);
    });
    test("retains noncenter-origin fallback", () => {
        const obj = object({originX: "left"});
        constrainOcclusionBounds(obj, {width: 100, height: 100});
        expect(obj.left).toBe(0);
        expect(obj.top).toBe(90);
    });
    test("serializes transforms rather than local group positions, with scaled sizes and optional hints", () => {
        const obj = object({
            calcTransformMatrix: () => [1, 0, 0, 1, 42, 53],
            angle: 15,
            hint: "hint",
            _objects: [{}, {text: "3"}]
        });
        expect(serializeOcclusionElements([obj])).toEqual([
            {left: 42, top: 53, width: 20, height: 10, angle: 15, cId: 3, hint: "hint"}
        ]);
        expect(serializeOcclusionElements([object()])[0]).not.toHaveProperty("hint");
        expect(serializeOcclusionElements([object()])[0].cId).toBe(1);
    });
});
