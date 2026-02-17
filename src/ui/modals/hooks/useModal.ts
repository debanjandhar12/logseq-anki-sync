import React from "../../React";
import { WindowBridge } from "../../../logseq/WindowBridge";
import { UI } from "../../UI";

export interface UseModalOptions<T = any> {
    onClose?: () => void;
    onConfirm?: (result: T) => void;
    onCancel?: () => void;
    defaultResult?: T;
    enableEscapeKey?: boolean;
    enableEnterKey?: boolean;
    modalId?: string | null;
}

export interface UseModalReturn<T = any> {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleConfirm: (result?: T) => void;
    handleCancel: () => void;
    returnResult: (result: T) => void;
}

/**
 * Base hook for modal state management and components behaviors
 */
export function useModal<T = any>(
    resolve: (value: T) => void,
    options: UseModalOptions<T> = {}
): UseModalReturn<T> {
    const {
        onClose,
        onConfirm,
        onCancel,
        defaultResult,
        enableEscapeKey = true,
        enableEnterKey = false,
        modalId,
    } = options;

    const [open, setOpen] = React.useState(true);

    const returnResult = React.useCallback(
        (result: T) => {
            resolve(result);
            setOpen(false);
        },
        [resolve]
    );

    const handleConfirm = React.useCallback(
        (result?: T) => {
            const finalResult = result !== undefined ? result : defaultResult;
            if (onConfirm) {
                onConfirm(finalResult);
            }
            returnResult(finalResult);
        },
        [returnResult, onConfirm, defaultResult]
    );

    const handleCancel = React.useCallback(() => {
        if (onCancel) {
            onCancel();
        }
        returnResult(null as T);
    }, [returnResult, onCancel]);

    // Handle modal close
    React.useEffect(() => {
        if (!open) {
            if (onClose) {
                onClose();
            }
        }
    }, [open, onClose]);

    // Handle keyboard events in plugin's own document
    React.useEffect(() => {
        if (!open) return;

        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;

            if (UI.getActiveModal() !== modalId) {
                return;
            }

            if (enableEscapeKey && e.key === "Escape") {
                handleCancel();
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (enableEnterKey && e.key === "Enter") {
                handleConfirm();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
        };
    }, [open, handleConfirm, handleCancel, enableEscapeKey, enableEnterKey, modalId]);

    return {
        open,
        setOpen,
        handleConfirm,
        handleCancel,
        returnResult,
    };
}
