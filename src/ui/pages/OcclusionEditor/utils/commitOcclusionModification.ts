import {constrainOcclusionBounds} from "./constrainOcclusionBounds";

/** A single modification path guarantees corrected coordinates enter history. */
export function commitOcclusionModification(
    obj: any,
    image: {width: number; height: number},
    save: () => void,
    render: () => void
) {
    if (obj) {
        constrainOcclusionBounds(obj, image);
        obj.setCoords();
    }
    save();
    render();
}
