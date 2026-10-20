import {fabric} from "fabric";
import {type RefObject, useCallback, useEffect, useRef} from "react";
import {createOcclusionRectEl} from "../../../utils/occlusionUtils";
import type {OcclusionElement} from "../../launchers/showOcclusionEditor";
import {serializeOcclusionElements} from "./serializeOcclusionElements";
import {commitOcclusionModification} from "./utils/commitOcclusionModification";

export function useOcclusionCanvasHistory(
    fabricRef: RefObject<any>,
    imgEl: HTMLImageElement,
    present: OcclusionElement[],
    setElements: (elements: OcclusionElement[]) => void,
    open: boolean
) {
    const lastSavedStateRef = useRef(present);
    useEffect(() => {
        if (!open) return;
        const canvas = fabricRef.current;
        if (!canvas || !imgEl.width) return;
        const currentObjects = canvas.getObjects();
        if (currentObjects.length === 0 && present.length === 0) return;
        if (present === lastSavedStateRef.current) return;
        lastSavedStateRef.current = present;
        canvas.remove(...currentObjects);
        present.forEach((obj) =>
            canvas.add(
                createOcclusionRectEl(
                    fabric,
                    obj.left,
                    obj.top,
                    obj.width,
                    obj.height,
                    obj.angle,
                    obj.cId,
                    obj.hint
                )
            )
        );
        canvas.discardActiveObject();
        canvas.renderAll();
    }, [present, fabricRef, imgEl, open]);
    const saveCanvasState = useCallback(() => {
        if (!fabricRef.current) return;
        const elements = serializeOcclusionElements(fabricRef.current.getObjects());
        lastSavedStateRef.current = elements;
        setElements(elements);
    }, [fabricRef, setElements]);
    useEffect(() => {
        if (!open) return;
        const canvas = fabricRef.current;
        if (!canvas) return;
        const modified = (event: any) =>
            commitOcclusionModification(event.target, imgEl, saveCanvasState, () =>
                canvas.renderAll()
            );
        canvas.on("object:modified", modified);
        return () => canvas.off("object:modified", modified);
    }, [fabricRef, imgEl, saveCanvasState, open]);
    return saveCanvasState;
}
