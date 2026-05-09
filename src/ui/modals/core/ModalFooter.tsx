import {LogseqButton} from "../../components/LogseqButton";
import React from "../../React";

export interface ModalFooterProps {
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: "primary" | "outline-link";
    showConfirm?: boolean;
    showCancel?: boolean;
    confirmShortcut?: string;
    children?: React.ReactNode;
    className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmColor = "primary",
    showConfirm = true,
    showCancel = true,
    confirmShortcut = "⏎",
    children,
    className = ""
}) => {
    return (
        <div className={`mt-5 sm:mt-4 sm:flex sm:flex-row-reverse ${className}`}>
            {children}
            {showConfirm && onConfirm && (
                <LogseqButton isFullWidth={true} onClick={onConfirm} color={confirmColor}>
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                        <span>{confirmText}</span>
                        {confirmShortcut && (
                            <span className="px-1 opacity-80">
                                <code>{confirmShortcut}</code>
                            </span>
                        )}
                    </span>
                </LogseqButton>
            )}
            {showCancel && onCancel && (
                <LogseqButton color={"outline-link"} isFullWidth={true} onClick={onCancel}>
                    {cancelText}
                </LogseqButton>
            )}
        </div>
    );
};

export const DialogModalFooter: React.FC<{
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    children?: React.ReactNode;
}> = ({onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", children}) => {
    return (
        <div
            className="mt-1 sm:flex sm:flex-row-reverse"
            style={{
                borderTop: "1px solid var(--ls-border-color)",
                padding: "2px",
                alignItems: "center"
            }}>
            {onConfirm && (
                <LogseqButton isFullWidth={true} depth={1} onClick={onConfirm} color="primary">
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                        <span>{confirmText}</span>
                        <span
                            className="opacity-80 ui__button-shortcut-key"
                            style={{marginLeft: "2px"}}>
                            ⏎
                        </span>
                    </span>
                </LogseqButton>
            )}
            {onCancel && (
                <LogseqButton
                    color={"outline-link"}
                    isFullWidth={true}
                    depth={1}
                    onClick={onCancel}>
                    {cancelText}
                </LogseqButton>
            )}
            {children && (
                <div className="float-right sm:float-left" style={{flexGrow: 1}}>
                    {children}
                </div>
            )}
        </div>
    );
};
