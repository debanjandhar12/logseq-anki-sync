import {WindowBridge} from "../../logseq/WindowBridge";
import {LogseqButton} from "../components/LogseqButton";
import React from "../React";
import {UI} from "../UI";
import {Modal} from "./core/Modal";
import {useModal} from "./hooks/useModal";

export interface InputModalProps {
    title?: string;
    message?: string;
    placeholder?: string;
    initialValue?: string;
    maxLength?: number;
    resolve: (value: string | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const InputModalComponent: React.FC<InputModalProps> = ({
    title,
    message,
    placeholder = "",
    initialValue = "",
    maxLength,
    resolve,
    reject,
    modalContext
}) => {
    const [inputValue, setInputValue] = React.useState(initialValue);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const {open, setOpen, returnResult} = useModal<string | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    const handleConfirm = React.useCallback(() => {
        returnResult(inputValue.trim() || null);
    }, [inputValue, returnResult]);

    const handleCancel = React.useCallback(() => {
        returnResult(null);
    }, [returnResult]);

    // Focus input on mount
    React.useEffect(() => {
        if (open && textareaRef.current) {
            // Small delay to ensure modal is rendered
            setTimeout(() => {
                textareaRef.current?.focus();
                textareaRef.current?.select();
            }, 50);
        }
    }, [open]);

    // Setup keyboard shortcuts
    React.useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;

            if (UI.getActiveModal() !== modalContext?.modalId) {
                return;
            }

            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (document.activeElement === textareaRef.current) {
                    textareaRef.current.blur();
                    return;
                }
                handleCancel();
            } else if (e.key === "Enter") {
                if (document.activeElement !== textareaRef.current) {
                    handleConfirm();
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown, true); // Use capture phase
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown, true);
        };
    }, [open, handleConfirm, handleCancel, modalContext?.modalId]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            zDepth="high">
            <div style={{margin: "1.25rem"}}>
                {title && (
                    <h2
                        style={{
                            margin: "0 0 0.75rem 0",
                            fontSize: "1.2rem",
                            fontWeight: 600,
                            color: "var(--ls-primary-text-color, #333)"
                        }}>
                        {title}
                    </h2>
                )}
                {message && (
                    <p
                        style={{
                            margin: "0 0 1rem 0",
                            opacity: 0.7,
                            fontSize: "0.875rem",
                            lineHeight: 1.5,
                            color: "var(--ls-secondary-text-color, #666)"
                        }}>
                        {message}
                    </p>
                )}
                <div style={{marginBottom: "1rem"}}>
                    <textarea
                        ref={textareaRef}
                        className="form-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        style={{
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.95rem",
                            border: "1px solid var(--ls-border-color, #ddd)",
                            borderRadius: "6px",
                            backgroundColor: "var(--ls-secondary-background-color, #f8f8f8)",
                            color: "var(--ls-primary-text-color, #333)",
                            outline: "none",
                            boxSizing: "border-box",
                            transition: "border-color 0.15s ease"
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = "var(--ls-link-text-color, #4a9eff)";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = "var(--ls-border-color, #ddd)";
                        }}
                    />
                    {maxLength != null && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginTop: "0.35rem",
                                fontSize: "0.75rem",
                                color:
                                    inputValue.length >= maxLength
                                        ? "var(--ls-error-text-color, #e53e3e)"
                                        : "var(--ls-secondary-text-color, #999)"
                            }}>
                            {inputValue.length}/{maxLength}
                        </div>
                    )}
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                        paddingTop: "0.25rem"
                    }}>
                    <LogseqButton onClick={handleCancel} color="ghost" size="sm">
                        Cancel
                    </LogseqButton>
                    <LogseqButton onClick={handleConfirm} color="primary" size="sm">
                        Confirm
                    </LogseqButton>
                </div>
            </div>
        </Modal>
    );
};
