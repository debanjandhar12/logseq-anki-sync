/** Preserve the editor's existing rotated bounding-box policy. */
export function constrainOcclusionBounds(obj: any, image: {width: number; height: number}) {
    const angleRad = obj.angle * (Math.PI / 180);
    const w = obj.getScaledWidth();
    const h = obj.getScaledHeight();
    const sceneH = Math.abs(w * Math.sin(angleRad)) + Math.abs(h * Math.cos(angleRad));
    const sceneW = Math.abs(w * Math.cos(angleRad)) + Math.abs(h * Math.sin(angleRad));
    if (obj.originX === "center") {
        obj.left = Math.min(Math.max(obj.left, sceneW / 2), image.width - sceneW / 2);
        obj.top = Math.min(Math.max(obj.top, sceneH / 2), image.height - sceneH / 2);
    } else {
        obj.left = Math.min(Math.max(obj.left, 0), image.width - sceneW);
        obj.top = Math.min(Math.max(obj.top, 0), image.height - sceneH);
    }
}
