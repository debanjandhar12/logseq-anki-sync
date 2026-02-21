import React from "../React";
import { Modal } from "./core/Modal";
import { useModal } from "./hooks/useModal";
import { SimpleModalHeader } from "./core/ModalHeader";
import { LogseqButton } from "../components/LogseqButton";
import { createModalPromise } from "./utils/createModalPromise";
import { UI } from "../UI";
import { WindowBridge } from "../../logseq/WindowBridge";

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
    modalContext?: { modalId: string | null };
    enableOutsideClickClose?: boolean;
}

const ButtonModalComponent: React.FC<ButtonModalProps> = ({
    message,
    buttons,
    resolve,
    reject,
    modalContext,
    enableOutsideClickClose = true,
}) => {
    const { open, setOpen, returnResult } = useModal<number | false>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableOutsideClickClose,
        defaultResult: false,
        modalId: modalContext?.modalId,
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
                                    dangerouslySetInnerHTML={{ __html: btn.icon }}
                                    style={{
                                        marginRight: "6px",
                                        display: "inline-flex",
                                        alignItems: "center",
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

/**
 * A model that shows message along with customizable buttons.
 * @return index of button pressed (or false when canceled from top right)
 */
export async function showButtonModal(
    message: string,
    buttons: ButtonModalButton[],
    options?: { enableOutsideClickClose?: boolean },
): Promise<number | false> {
    return createModalPromise<number | false>(
        (props) => <ButtonModalComponent message={message} buttons={buttons} {...props} />,
        { enableOutsideClickClose: options?.enableOutsideClickClose },
        { errorMessage: "Failed to open button modal" },
    );
}
