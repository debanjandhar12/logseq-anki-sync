/**
 * Shared utility functions for image occlusion functionality.
 * Safe to import from Anki template JS files.
 */
export function createOcclusionRectEl(
    fabric,
    left = 0,
    top = 0,
    width = 80,
    height = 40,
    angle = 0,
    cId = 1,
    hint = null
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
        originY: "center"
    });

    const text = new fabric.Text(`${cId}`, {
        originX: "center",
        originY: "center"
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
        objectCaching: false
    });

    if (hint) {
        updateOcclusionHint(group, hint, fabric);
    }

    return group;
}

/**
 * Updates or adds a hint to an occlusion group.
 * Managing the lifecycle of the hint text and its positioning events.
 */
export function updateOcclusionHint(group, hint, fabric) {
    // 1. cleanup existing hint
    // We assume any object after the first 2 (Rect, Text) is part of the hint
    // or specifically check for our hintText properties if needed.
    // Ideally we should track the hint object reference, assuming standard structure [Rect, ID, Hint?]
    if (group._objects && group._objects.length > 2) {
        const objectsToRemove = group._objects.slice(2);
        objectsToRemove.forEach((obj) => group.remove(obj));
    }

    // Remove previous listeners if they exist to avoid duplication/memory leaks
    if (group.__hintListener) {
        const events = ["added", "moving", "scaling", "rotating", "modified"];
        events.forEach((e) => group.off(e, group.__hintListener));
        delete group.__hintListener;
    }

    // Update the hint property on the group
    if (!hint) {
        delete group.hint;
        group.set("dirty", true);
        if (group.canvas) group.canvas.requestRenderAll();
        return;
    }

    group.hint = hint;

    // 2. Create new hint text
    // The group width/height are the unscaled dimensions of the defined group box.
    const width = group.width;
    const height = group.height;

    const fontSize = Math.max(11, Math.min(width, height) * 0.12);
    const padding = Math.max(3, fontSize * 0.3);

    const hintText = new fabric.Text(hint, {
        fontSize: fontSize,
        fill: "#fff",
        fontFamily: "sans-serif",
        backgroundColor: "rgba(35, 90, 235, 0.4)",
        originX: "center",
        originY: "center",
        padding: padding,
        selectable: false,
        evented: false,
        excludeFromExport: true
    });

    group.add(hintText);

    // --- Boundary Detection Logic ---
    const adjustHintPosition = () => {
        if (!group.canvas) return;

        // Use logical canvas dimensions corrected for zoom
        // (fabric canvas.width is the pixel width of the element)
        const zoom = group.canvas.getZoom() || 1;
        const canvasWidth = group.canvas.width / zoom;
        const canvasHeight = group.canvas.height / zoom;

        // 2. Calculate Group's Scene-Space AABB (Axis Aligned Bounding Box)
        // This gives us the visual bounds of the rotated rectangle in the unzoomed scene.
        const angleRad = group.angle * (Math.PI / 180);
        const gW = group.getScaledWidth(); // width * sx
        const gH = group.getScaledHeight(); // height * sy
        const _sceneAABBWidth =
            Math.abs(gW * Math.cos(angleRad)) + Math.abs(gH * Math.sin(angleRad));
        const sceneAABBHeight =
            Math.abs(gW * Math.sin(angleRad)) + Math.abs(gH * Math.cos(angleRad));

        // Scene-space center of the group
        const center = group.getCenterPoint();

        const safetyMargin = 8;

        // Calculate desired font size/scale relative to canvas width
        // Target: ~3% of canvas width or 16px, whichever is larger
        // This ensures readability on large images while preventing it from being huge on small screens.
        const targetFontSize = Math.max(16, canvasWidth * 0.03);
        // hintText.fontSize is the unscaled font size.
        // We need scale * fontSize = targetFontSize
        const desiredScale = targetFontSize / (hintText.fontSize || 16);

        // Visual dimensions of hint text with desired scale
        const hintVisualH = hintText.height * desiredScale;
        const hintVisualW = hintText.width * desiredScale;

        // 3. Determine Global Y Position
        // Default: Below the visual bounding box
        const defaultY = center.y + sceneAABBHeight / 2 + padding + hintVisualH / 2;
        const altY = center.y - sceneAABBHeight / 2 - padding - hintVisualH / 2;

        let targetGlobalY = defaultY;

        // If default bleeds bottom AND alt fits top, switch to alt
        const bleedsBottom = defaultY + hintVisualH / 2 + safetyMargin > canvasHeight;
        const fitsTop = altY - hintVisualH / 2 - safetyMargin > 0;

        if (bleedsBottom && fitsTop) {
            targetGlobalY = altY;
        }

        // 4. Determine Global X Position
        let targetGlobalX = center.x; // Start centered

        const leftEdge = targetGlobalX - hintVisualW / 2;
        const rightEdge = targetGlobalX + hintVisualW / 2;

        if (leftEdge < safetyMargin) {
            // Push right
            targetGlobalX = safetyMargin + hintVisualW / 2;
        } else if (rightEdge > canvasWidth - safetyMargin) {
            // Push left
            targetGlobalX = canvasWidth - safetyMargin - hintVisualW / 2;
        }

        // 5. Apply Transform
        // We want the text to be at (targetGlobalX, targetGlobalY) in global space,
        // with 0 rotation and DESIRED scale (relative to global).
        // M_desired = [ desiredScale, 0, 0, desiredScale, targetGlobalX, targetGlobalY ]

        const mDesired = [desiredScale, 0, 0, desiredScale, targetGlobalX, targetGlobalY];
        const mGroup = group.calcTransformMatrix();
        const mGroupInv = fabric.util.invertTransform(mGroup);
        const mLocal = fabric.util.multiplyTransformMatrices(mGroupInv, mDesired);
        const options = fabric.util.qrDecompose(mLocal);

        hintText.set({
            angle: options.angle,
            scaleX: options.scaleX,
            scaleY: options.scaleY,
            skewX: options.skewX,
            skewY: options.skewY,
            left: options.translateX,
            top: options.translateY
        });

        // Force update
        group.set("dirty", true);
        group.canvas.requestRenderAll();
    };

    // Store listener reference for cleanup
    group.__hintListener = adjustHintPosition;

    // Fire on canvas injection, dragging, resizing, and rotating
    group.on("added", adjustHintPosition);
    group.on("moving", adjustHintPosition);
    group.on("scaling", adjustHintPosition);
    group.on("rotating", adjustHintPosition);
    group.on("modified", adjustHintPosition); // Catch-all for end of operations

    // Explicitly call once if already on canvas
    if (group.canvas) {
        adjustHintPosition();
    }

    return group;
}
