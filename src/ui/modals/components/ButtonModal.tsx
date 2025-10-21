import React from "../../React";
import { Modal } from "../Modal";
import { useModal } from "../hooks/useModal";
import { SimpleModalHeader } from "../ModalHeader";
import { LogseqButton } from "../../common/LogseqButton";
import { createModalPromise } from "../utils/createModalPromise";

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
    onClose: () => void;
}

const ButtonModalComponent: React.FC<ButtonModalProps> = ({
    message,
    buttons,
    resolve,
    reject,
    onClose,
}) => {
    const { open, setOpen, returnResult } = useModal<number | false>(resolve, {
        onClose,
        enableEscapeKey: true,
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

        window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open, returnResult]);

    React.useEffect(() => {
        if (!open) {
            returnResult(false);
        }
    }, [open, returnResult]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} zDepth="high">
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
