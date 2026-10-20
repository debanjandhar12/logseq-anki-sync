import type {OcclusionElement} from "../../../launchers/showOcclusionEditor";

/** Allocate a cloze and place a new rectangle inside the visible image area when possible. */
export function createOcclusionElement(
    image: {width: number; height: number},
    elements: OcclusionElement[],
    viewport?: {left: number; top: number; width: number; height: number}
): OcclusionElement {
    const width = 0.22 * image.width;
    const height = 0.22 * image.height;
    const usedCIds = elements.map((element) => element.cId);
    let cId = 1;
    while (usedCIds.includes(cId) && cId < 10) cId++;
    if (cId > 9) cId = 1;
    let left: number;
    let top: number;
    const minX = viewport ? Math.max(width / 2, viewport.left + width / 2) : 0;
    const maxX = viewport
        ? Math.min(image.width - width / 2, viewport.left + viewport.width - width / 2)
        : 0;
    const minY = viewport ? Math.max(height / 2, viewport.top + height / 2) : 0;
    const maxY = viewport
        ? Math.min(image.height - height / 2, viewport.top + viewport.height - height / 2)
        : 0;
    if (viewport && maxX > minX && maxY > minY) {
        left = minX + Math.random() * (maxX - minX);
        top = minY + Math.random() * (maxY - minY);
    } else {
        left = Math.floor(Math.random() * (image.width - width)) + width / 2 + 0.11 * image.width;
        top =
            Math.floor(Math.random() * (image.height - height)) + height / 2 + 0.11 * image.height;
    }
    return {left, top, width, height, angle: 0, cId};
}
