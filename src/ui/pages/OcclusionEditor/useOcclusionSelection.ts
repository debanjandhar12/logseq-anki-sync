import {fabric} from "fabric";
import {type RefObject, useEffect, useState} from "react";
import {constrainOcclusionBounds} from "./utils/constrainOcclusionBounds";

export function useOcclusionSelection(
    fabricRef: RefObject<any>,
    image: HTMLImageElement,
    open: boolean,
    setClozeId: (id: string) => void
) {
    const [selection, setSelection] = useState<any[] | null>([]);
    useEffect(() => {
        if (!open) return;
        const canvas = fabricRef.current;
        if (!canvas) return;
        const updateSelection = () => setSelection(canvas.getActiveObjects());
        const clearSelection = () => setSelection(null);
        const restrictGroupTransforms = () => {
            const locked = canvas.getActiveObjects().length > 1;
            fabric.Group.prototype.lockScalingX = locked;
            fabric.Group.prototype.lockScalingY = locked;
            fabric.Group.prototype.lockRotation = locked;
            canvas.renderAll();
        };
        const moving = (event: any) => constrainOcclusionBounds(event.target, image);
        canvas.on("selection:created", updateSelection);
        canvas.on("selection:updated", updateSelection);
        canvas.on("selection:cleared", clearSelection);
        canvas.on("selection:created", restrictGroupTransforms);
        canvas.on("object:moving", moving);
        return () => {
            canvas.off("selection:created", updateSelection);
            canvas.off("selection:updated", updateSelection);
            canvas.off("selection:cleared", clearSelection);
            canvas.off("selection:created", restrictGroupTransforms);
            canvas.off("object:moving", moving);
        };
    }, [fabricRef, image, open]);
    useEffect(() => {
        const text = selection?.[0]?._objects?.[1]?.text;
        if (text) setClozeId(text);
    }, [selection, setClozeId]);
    return {fabricSelection: selection, setFabricSelection: setSelection};
}
