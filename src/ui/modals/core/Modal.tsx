import FocusTrap from "focus-trap-react";
import React, {type PropsWithChildren} from "../../React";
import {UI} from "../../UI";

const focusTrapOptions = {
    tabbableOptions: {
        displayCheck: "none" as const
    }
};

interface ModalProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onClose?: () => void;
    size?: "default" | "large";
    zDepth?: "high" | "default";
    hasCloseButton?: boolean;
    className?: string;
}

export function Modal({
    open,
    setOpen,
    size = "default",
    zDepth = "default",
    onClose,
    children,
    hasCloseButton = true,
    className = ""
}: PropsWithChildren<ModalProps>) {
    // Handle close - calls setOpen(false), onClose callback, and UI.hideModal()
    const handleClose = React.useCallback(() => {
        setOpen(false);
        if (onClose) {
            onClose();
        }
        UI.hideModal();
    }, [setOpen, onClose]);

    let style = {};
    if (size === "large") {
        style = {...style, width: "90vw"};
    }

    if (!open) return null;

    // Calculate z-index based on modal depth (number of modals currently open)
    const modalDepth = UI.getModalCount();
    const baseZIndex = zDepth === "high" ? 9999 : 1000;
    const calculatedZIndex = baseZIndex + modalDepth * 10;

    return (
        <FocusTrap focusTrapOptions={focusTrapOptions}>
            <div
                className="fixed inset-0 flex items-center justify-center p-4"
                style={{zIndex: calculatedZIndex}}>
                {/* Overlay */}
                <div className="fixed inset-0 bg-black/50" />

                {/* Modal Panel */}
                <div
                    className="relative bg-secondary-background border border-border rounded-md shadow-lg z-10"
                    style={size === "large" ? {width: "90vw"} : {width: "60vw"}}>
                    {hasCloseButton && (
                        <div className="absolute top-0 right-0 pt-2 pr-2">
                            <button
                                aria-label="Close"
                                type="button"
                                className="text-gray-400 hover:text-gray-600 opacity-60 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none"
                                onClick={handleClose}>
                                <svg
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className="h-6 w-6">
                                    <path
                                        d="M6 18L18 6M6 6l12 12"
                                        strokeWidth="2"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"></path>
                                </svg>
                            </button>
                        </div>
                    )}
                    <div className={`max-h-[80vh] ${className}`}>{children}</div>
                </div>
            </div>
        </FocusTrap>
    );
}
