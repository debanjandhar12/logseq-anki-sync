import {LogseqButton} from "../components/LogseqButton";
import React from "../React";
import {UI} from "../UI";
import {Modal} from "./core/Modal";
import {SimpleModalHeader} from "./core/ModalHeader";
import {useModal} from "./hooks/useModal";

export interface ButtonModalButton {
    name: string;
    f: Function;
    closeOnClick?: boolean;
    icon?: string;
}

export interface ButtonModalProps {
    message: string;
    buttons: ButtonModalButton[];
    resolve: (value: number | false) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
    enableOutsideClickClose?: boolean;
}

export const ButtonModalComponent: React.FC<ButtonModalProps> = ({
    message,
    buttons,
    resolve,
    reject,
    modalContext,
    enableOutsideClickClose = true
}) => {
    const {open, setOpen, returnResult} = useModal<number | false>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableOutsideClickClose,
        defaultResult: false,
        modalId: modalContext?.modalId
    });

    React.useEffect(() => {
        if (!open) {
            returnResult(false);
        }
    }, [open, returnResult]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            zDepth="high">
            <div className="ui__confirm-modal is-">
                <SimpleModalHeader title={message} />
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    {buttons.map((btn, i) => (
                        <LogseqButton
                            key={i}
                            isFullWidth={true}
                            color="primary"
                            onClick={() => {
                                btn.f();
                                if (btn.closeOnClick == null || btn.closeOnClick === true) {
                                    returnResult(i);
                                }
                            }}>
                            {btn.icon && (
                                <span
                                    dangerouslySetInnerHTML={{__html: btn.icon}}
                                    style={{
                                        marginRight: "6px",
                                        display: "inline-flex",
                                        alignItems: "center"
                                    }}
                                />
                            )}
                            {btn.name}
                        </LogseqButton>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
