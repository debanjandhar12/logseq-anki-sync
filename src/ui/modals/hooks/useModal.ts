import {WindowBridge} from "../../../logseq/WindowBridge";
import React from "../../React";
import {UI} from "../../UI";

export interface UseModalOptions<T = any> {
    onClose?: () => void;
    onConfirm?: (result: T) => void;
    onCancel?: () => void;
    defaultResult?: T;
    enableEscapeKey?: boolean;
    enableEnterKey?: boolean;
    enableOutsideClickClose?: boolean;
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
        enableOutsideClickClose = true,
        modalId
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
                const activeElement = document.activeElement;
                const isCancelButtonFocused =
                    activeElement?.tagName === "BUTTON" &&
                    (activeElement.classList.contains("cancel") ||
                        activeElement.classList.contains("btn-cancel") ||
                        activeElement.getAttribute("data-action") === "cancel" ||
                        activeElement.textContent?.toLowerCase().includes("cancel"));

                if (isCancelButtonFocused) {
                    handleCancel();
                } else {
                    handleConfirm();
                }
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key === "ArrowDown") {
                if (
                    document.activeElement?.tagName === "INPUT" ||
                    document.activeElement?.tagName === "TEXTAREA"
                ) {
                    return; // Don't intercept when typing
                }
                const container = modalId
                    ? WindowBridge.getElementById(modalId)
                    : WindowBridge.getBody();
                const divWithScrollbar = Array.from(
                    (container || WindowBridge.getBody()).querySelectorAll(".overflow-y-auto")
                ).filter((div) => {
                    return div.scrollHeight > div.clientHeight;
                })[0];
                if (divWithScrollbar) {
                    divWithScrollbar.scrollTop = divWithScrollbar.scrollTop + 50;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            } else if (e.key === "ArrowUp") {
                if (
                    document.activeElement?.tagName === "INPUT" ||
                    document.activeElement?.tagName === "TEXTAREA"
                ) {
                    return; // Don't intercept when typing
                }
                const container = modalId
                    ? WindowBridge.getElementById(modalId)
                    : WindowBridge.getBody();
                const divWithScrollbar = Array.from(
                    (container || WindowBridge.getBody()).querySelectorAll(".overflow-y-auto")
                ).filter((div) => {
                    return div.scrollHeight > div.clientHeight;
                })[0];
                if (divWithScrollbar) {
                    divWithScrollbar.scrollTop = divWithScrollbar.scrollTop - 50;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
        };
    }, [open, handleConfirm, handleCancel, enableEscapeKey, enableEnterKey, modalId]);

    // Handle click outside to close
    React.useEffect(() => {
        if (!open || !enableOutsideClickClose) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is on the overlay (has bg-black/50 class)
            if (target.classList.contains("bg-black/50")) {
                if (UI.getActiveModal() !== modalId) {
                    return;
                }
                handleCancel();
            }
        };

        WindowBridge.addDocumentEventListener("click", handleClickOutside);
        return () => {
            WindowBridge.removeDocumentEventListener("click", handleClickOutside);
        };
    }, [open, handleCancel, enableOutsideClickClose, modalId]);

    return {
        open,
        setOpen,
        handleConfirm,
        handleCancel,
        returnResult
    };
}
