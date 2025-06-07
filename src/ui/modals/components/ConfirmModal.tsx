import React from "../../React";
import { Modal } from "../Modal";
import { useModal } from "../hooks/useModal";
import { SimpleModalHeader } from "../ModalHeader";
import { ModalFooter } from "../ModalFooter";
import { createModalPromise } from "../utils/createModalPromise";

export interface ConfirmModalProps {
    message: string;
    confirmText?: string;
    cancelText?: string;
    resolve: (value: boolean) => void;
    reject: (error: any) => void;
    onClose: () => void;
}

const ConfirmModalComponent: React.FC<ConfirmModalProps> = ({
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    resolve,
    reject,
    onClose,
}) => {
    const { open, setOpen, handleConfirm, handleCancel } = useModal<boolean>(resolve, {
        onClose,
        enableEscapeKey: true,
        enableEnterKey: true,
        defaultResult: true,
    });

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} zDepth="high">
            <div className="ui__confirm-modal is-">
                <SimpleModalHeader title={message} />
                <ModalFooter
                    onConfirm={() => handleConfirm(true)}
                    onCancel={() => handleCancel()}
                    confirmText={confirmText}
                    cancelText={cancelText}
                    confirmShortcut="⏎"
                />
            </div>
        </Modal>
    );
};

/**
 * A confirmation model that returns boolean based on cancel or ok button click
 */
export async function showConfirmModal(
    message: string,
    options: {
        confirmText?: string;
        cancelText?: string;
    } = {}
): Promise<boolean> {
    return createModalPromise<boolean>(
        (props) => (
            <ConfirmModalComponent
                message={message}
                confirmText={options.confirmText}
                cancelText={options.cancelText}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open confirmation modal" }
    );
}
