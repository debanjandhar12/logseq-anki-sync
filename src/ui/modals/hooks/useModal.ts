import React from "../../React";

export interface UseModalOptions<T = any> {
    onClose?: () => void;
    onConfirm?: (result: T) => void;
    onCancel?: () => void;
    defaultResult?: T;
    enableEscapeKey?: boolean;
    enableEnterKey?: boolean;
}

export interface UseModalReturn<T = any> {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleConfirm: (result?: T) => void;
    handleCancel: () => void;
    returnResult: (result: T) => void;
}

/**
 * Base hook for modal state management and common behaviors
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

    // Handle keyboard events
    React.useEffect(() => {
        if (!open) return;

        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;

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

        window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open, handleConfirm, handleCancel, enableEscapeKey, enableEnterKey]);

    return {
        open,
        setOpen,
        handleConfirm,
        handleCancel,
        returnResult,
    };
}
