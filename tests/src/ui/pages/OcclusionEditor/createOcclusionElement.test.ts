import {afterEach, expect, test, vi} from "vitest";
import {createOcclusionElement} from "../../../../../src/ui/pages/OcclusionEditor/utils/createOcclusionElement";

afterEach(() => vi.restoreAllMocks());

test("allocates the first free cloze ID and places a rectangle in the visible viewport", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const initial = createOcclusionElement({width: 1000, height: 500}, []);
    const element = createOcclusionElement(
        {width: 1000, height: 500},
        [
            {...initial, cId: 1},
            {...initial, cId: 3}
        ],
        {left: 200, top: 100, width: 400, height: 250}
    );
    expect(element).toEqual({left: 400, top: 225, width: 220, height: 110, angle: 0, cId: 2});
});

test("retains random-placement fallback and wraps exhausted cloze IDs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const initial = createOcclusionElement({width: 100, height: 100}, []);
    const element = createOcclusionElement(
        {width: 100, height: 100},
        Array.from({length: 9}, (_, index) => ({...initial, cId: index + 1})),
        {left: 0, top: 0, width: 1, height: 1}
    );
    expect(element).toEqual({left: 22, top: 22, width: 22, height: 22, angle: 0, cId: 1});
});
