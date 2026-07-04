import React from "react";
import {Modal} from "../modals/core/Modal";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export interface AIChatModalProps {
    chatComponent: React.ReactElement<{onClose?: () => void}>;
    resolve: (value: undefined) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const AIChatModalComponent: React.FC<AIChatModalProps> = ({
    chatComponent,
    resolve,
    modalContext
}) => {
    const {open, setOpen, returnResult} = useModal<undefined>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableOutsideClickClose: false,
        defaultResult: undefined,
        modalId: modalContext?.modalId
    });

    React.useEffect(() => {
        if (!open) {
            returnResult(undefined);
        }
    }, [open, returnResult]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            size="chat"
            zDepth="high"
            hasCloseButton={false}
            className="overflow-hidden">
            <div className="h-full w-full" style={{height: "80vh"}}>
                {React.cloneElement(chatComponent, {onClose: () => setOpen(false)})}
            </div>
        </Modal>
    );
};
