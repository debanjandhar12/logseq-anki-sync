/**
 * Shared utility functions for image occlusion functionality.
 * This file is safe to import from anki template JS files as it has no
 * dependencies on UI modules or React.
 */

/**
 * Creates a fabric.js occlusion rectangle element for image occlusion cards.
 * This function is used both in the Anki card templates and in the OcclusionEditor UI.
 * 
 * @param {number} left - X position
 * @param {number} top - Y position  
 * @param {number} width - Width of the occlusion
 * @param {number} height - Height of the occlusion
 * @param {number} angle - Rotation angle
 * @param {number} cId - Cloze ID number
 * @param {object} fabric - The fabric.js library object
 * @returns {object} fabric.Group containing the occlusion rectangle
 */
export function createOcclusionRectEl(
    fabric,
    left = 0,
    top = 0,
    width = 80,
    height = 40,
    angle = 0,
    cId = 1,
) {
    const rect = new fabric.Rect({
        fill: "#FFEBA2",
        stroke: "#000",
        strokeWidth: 1,
        strokeUniform: true,
        noScaleCache: false,
        opacity: 0.8,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
    });
    const text = new fabric.Text(`${cId}`, {
        originX: "center",
        originY: "center",
    });
    text.scaleToHeight(height);
    const group = new fabric.Group([rect, text], {
        left: left,
        top: top,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
        angle: angle,
    });
    return group;
}
