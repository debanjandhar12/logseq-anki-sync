import React from "../React";
import { Modal } from "./core/Modal";
import { useModal } from "./hooks/useModal";
import { SimpleModalHeader } from "./core/ModalHeader";
import { ModalFooter } from "./core/ModalFooter";
import { UI } from "../UI";

export interface ConfirmModalProps {
    message: string;
    confirmText?: string;
    cancelText?: string;
    resolve: (value: boolean) => void;
    reject: (error: any) => void;
    modalContext?: { modalId: string | null };
}

export const ConfirmModalComponent: React.FC<ConfirmModalProps> = ({
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
        enableOutsideClickClose: false,
        defaultResult: true,
        modalId: modalContext?.modalId,
    });

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => {
                UI.hideModal(modalContext?.modalId);
                handleCancel();
            }}
            hasCloseButton={false}
            zDepth="high">
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


