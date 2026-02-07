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
}

export interface ButtonModalProps {
    message: string;
    buttons: ButtonModalButton[];
    resolve: (value: number | false) => void;
    reject: (error: any) => void;
    modalContext?: { modalId: string | null };
}

const ButtonModalComponent: React.FC<ButtonModalProps> = ({
    message,
    buttons,
    resolve,
    reject,
    modalContext,
}) => {
    const { open, setOpen, returnResult } = useModal<number | false>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        modalId: modalContext?.modalId,
    });

    // Custom keyboard handling for numbered buttons
    React.useEffect(() => {
        if (!open) return;

        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;
            
            if (e.key === "Escape") {
                returnResult(false);
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
        };
    }, [open, returnResult]);

    React.useEffect(() => {
        if (!open) {
            returnResult(false);
        }
    }, [open, returnResult]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={() => UI.hideModal(modalContext?.modalId)} zDepth="high">
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
                            }}
                        >
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
    buttons: ButtonModalButton[]
): Promise<number | false> {
    return createModalPromise<number | false>(
        (props) => (
            <ButtonModalComponent
                message={message}
                buttons={buttons}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open button modal" }
    );
}
