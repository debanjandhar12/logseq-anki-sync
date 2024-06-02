import React, {PropsWithChildren} from "react";
import ReactDOM from "react-dom";
import FocusTrap from "focus-trap-react";

interface ModalProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onClose?: () => void;
    size?: "default" | "large";
    zDepth?: "high" | "default";
    hasCloseButton?: boolean;
}

export function Modal({
    open,
    setOpen,
    size = "default",
    zDepth = "default",
    onClose,
    children,
    hasCloseButton = true,
}: PropsWithChildren<ModalProps>) {
    React.useEffect(() => {
        if (!open && onClose) {
            onClose();
        }
    }, [open]);

    if (!open) return null;
    let style = {};
    if (size === "large") {
        style = {...style, width: "90vw"};
    }

    const onKeydown = React.useCallback((e: KeyboardEvent) => {
        if (!open) return;
        if (e.key === "ArrowDown") {
            let divWithScrollbar = Array.from(window.parent.document.querySelectorAll('.ui__modal div')).filter(div => {
                return div.scrollHeight > div.clientHeight;
            })[0];
            if (divWithScrollbar) {
                divWithScrollbar.scrollTop = divWithScrollbar.scrollTop + 50;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        else if (e.key === "ArrowUp") {
            let divWithScrollbar = Array.from(window.parent.document.querySelectorAll('.ui__modal div')).filter(div => {
                return div.scrollHeight > div.clientHeight;
            })[0];
            if (divWithScrollbar) {
                divWithScrollbar.scrollTop = divWithScrollbar.scrollTop - 50;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, []);
    React.useEffect(() => {
        if (open) window.parent.document.addEventListener("keydown", onKeydown);
        else onClose();
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open]);

    return (
        <FocusTrap>
            <div className={`ui__modal`} style={{zIndex: zDepth === "high" ? 9999 : 999}}>
                <div className="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
                    <div className="absolute inset-0 opacity-75"></div>
                </div>
                <div className="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
                    {hasCloseButton && (
                        <div className="absolute top-0 right-0 pt-2 pr-2">
                            <button
                                aria-label="Close"
                                type="button"
                                className="ui__modal-close opacity-60 hover:opacity-100"
                                onClick={() => setOpen(false)}>
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
                    <div className="panel-content" style={style}>
                        {children}
                    </div>
                </div>
            </div>
        </FocusTrap>
    );
}
