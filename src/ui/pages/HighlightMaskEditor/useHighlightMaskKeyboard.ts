import {useEffect} from "react";
import {WindowBridge} from "../../../logseq/WindowBridge";
import {UI} from "../../UI";

interface HighlightMaskKeyboardOptions {
    open: boolean;
    modalId?: string | null;
    selectedElementIndex: number | null;
    selectElement: (index: number | null) => void;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    confirm: () => void;
    cancel: () => void;
    deleteHighlight: () => void;
    changeClozeId: (value: string) => void;
}

export function useHighlightMaskKeyboard({
    open,
    modalId,
    selectedElementIndex,
    selectElement,
    canUndo,
    canRedo,
    undo,
    redo,
    confirm,
    cancel,
    deleteHighlight,
    changeClozeId
}: HighlightMaskKeyboardOptions) {
    useEffect(() => {
        if (!open) return;
        const onKeydown = (event: KeyboardEvent) => {
            if (UI.getActiveModal() !== modalId) return;
            if (event.key === "Escape") {
                if (selectedElementIndex !== null) selectElement(null);
                else cancel();
            } else if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
                if (canUndo) undo();
            } else if (event.ctrlKey && event.key === "Z" && event.shiftKey) {
                if (canRedo) redo();
            } else if (event.key === "Enter" && !event.shiftKey) {
                confirm();
            } else if (event.key === "Delete" && selectedElementIndex !== null) {
                deleteHighlight();
            } else if (event.key >= "1" && event.key <= "9" && selectedElementIndex !== null) {
                changeClozeId(event.key);
            } else return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        WindowBridge.addDocumentEventListener("keydown", onKeydown, {capture: true});
        return () =>
            WindowBridge.removeDocumentEventListener("keydown", onKeydown, {capture: true});
    }, [
        open,
        modalId,
        selectedElementIndex,
        selectElement,
        canUndo,
        canRedo,
        undo,
        redo,
        confirm,
        cancel,
        deleteHighlight,
        changeClozeId
    ]);
}
