import React from "react";
import {UI} from "../UI";
import {Modal} from "./core/Modal";
import {useModal} from "./hooks/useModal";

export interface AIChatModalProps {
    chatComponent: React.ReactElement;
    resolve: (value: void) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const AIChatModalComponent: React.FC<AIChatModalProps> = ({
    chatComponent,
    resolve,
    reject,
    modalContext
}) => {
    const {open, setOpen, returnResult} = useModal<void>(resolve, {
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
            hasCloseButton={true}
            className="overflow-hidden">
            <div className="h-full w-full" style={{height: "80vh", marginTop: "32px"}}>
                {chatComponent}
            </div>
        </Modal>
    );
};
