import React from "../React";
import { Modal } from "./core/Modal";
import { useModal } from "./hooks/useModal";
import { SimpleModalHeader } from "./core/ModalHeader";
import { ModalFooter } from "./core/ModalFooter";
import { createModalPromise } from "./utils/createModalPromise";
import { UI } from "../UI";

export interface ConfirmModalProps {
    message: string;
    confirmText?: string;
    cancelText?: string;
    resolve: (value: boolean) => void;
    reject: (error: any) => void;
    modalContext?: { modalId: string | null };
}

const ConfirmModalComponent: React.FC<ConfirmModalProps> = ({
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    resolve,
    reject,
    modalContext,
}) => {
    const { open, setOpen, handleConfirm, handleCancel } = useModal<boolean>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableEnterKey: true,
        defaultResult: true,
        modalId: modalContext?.modalId,
    });

    return (
        <Modal open={open} setOpen={setOpen} onClose={() => {UI.hideModal(modalContext?.modalId); handleCancel();}} hasCloseButton={false} enableOutsideClickClose={false} zDepth="high">
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
