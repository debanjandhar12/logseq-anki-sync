import {fabric} from "fabric";
import {type RefObject, useEffect} from "react";
import {WindowBridge} from "../../../logseq/WindowBridge";
import {UI} from "../../UI";
import type {ToolType} from "./types";

interface OcclusionKeyboardOptions {
    open: boolean;
    modalId?: string | null;
    fabricRef: RefObject<any>;
    activeTool: ToolType;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    confirm: () => void;
    cancel: () => void;
    addOcclusion: () => void;
    deleteOcclusion: () => void;
    changeClozeId: (value: string) => void;
}

export function useOcclusionKeyboard({
    open,
    modalId,
    fabricRef,
    activeTool,
    canUndo,
    canRedo,
    undo,
    redo,
    confirm,
    cancel,
    addOcclusion,
    deleteOcclusion,
    changeClozeId
}: OcclusionKeyboardOptions) {
    useEffect(() => {
        if (!open) return;
        const onKeydown = (event: KeyboardEvent) => {
            const canvas = fabricRef.current;
            if (!canvas || UI.getActiveModal() !== modalId) return;
            if (event.key === "Escape") {
                if (canvas.getActiveObjects().length > 0) {
                    canvas.discardActiveObject();
                    canvas.renderAll();
                } else cancel();
            } else if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
                if (canUndo) undo();
            } else if (event.ctrlKey && event.key === "Z" && event.shiftKey) {
                if (canRedo) redo();
            } else if (event.ctrlKey && event.key === "a") {
                if (activeTool !== "select") return;
                canvas.discardActiveObject();
                canvas.setActiveObject(new fabric.ActiveSelection(canvas.getObjects(), {canvas}));
                canvas.renderAll();
            } else if (event.key === "Enter") confirm();
            else if (event.key === "Delete" && canvas.getActiveObjects().length > 0)
                deleteOcclusion();
            else if (event.key === "Insert") addOcclusion();
            else {
                const activeObject = canvas.getActiveObject();
                if (!activeObject || activeTool !== "select") return;
                switch (event.key) {
                    case "ArrowUp":
                        activeObject.top -= 1;
                        break;
                    case "ArrowDown":
                        activeObject.top += 1;
                        break;
                    case "ArrowLeft":
                        activeObject.left -= 1;
                        break;
                    case "ArrowRight":
                        activeObject.left += 1;
                        break;
                    default:
                        if (event.key < "1" || event.key > "9") return;
                        changeClozeId(event.key);
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        return;
                }
                canvas.fire("object:modified", {target: activeObject});
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        WindowBridge.addDocumentEventListener("keydown", onKeydown, {capture: true});
        return () =>
            WindowBridge.removeDocumentEventListener("keydown", onKeydown, {capture: true});
    }, [
        open,
        modalId,
        fabricRef,
        activeTool,
        canUndo,
        canRedo,
        undo,
        redo,
        confirm,
        cancel,
        addOcclusion,
        deleteOcclusion,
        changeClozeId
    ]);
}
