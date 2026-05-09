import {WindowBridge} from "../../logseq/WindowBridge";
import {LogseqButton} from "../components/LogseqButton";
import React from "../React";
import {UI} from "../UI";
import {Modal} from "./core/Modal";
import {useModal} from "./hooks/useModal";

export interface SelectionModalItem {
    name: string;
    icon?: string;
}

export interface SelectionModalProps {
    items: SelectionModalItem[];
    message?: string;
    enableKeySelect?: boolean;
    resolve: (value: number | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const SelectionModalComponent: React.FC<SelectionModalProps> = ({
    items,
    message,
    enableKeySelect = false,
    resolve,
    reject,
    modalContext
}) => {
    const [displayItems, setDisplayItems] = React.useState(items);

    const {open, setOpen, returnResult} = useModal<number | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    const handleSelection = React.useCallback(
        (selection: number | null) => {
            if (selection === null) {
                returnResult(null);
            } else {
                returnResult(selection);
            }
        },
        [returnResult, items]
    );

    // Setup keyboard shortcuts for numbered selection
    React.useEffect(() => {
        if (enableKeySelect) {
            setDisplayItems(() =>
                items.map((item, i) => {
                    if (i + 1 >= 1 && i + 1 <= 9) {
                        return {
                            ...item,
                            name: `${item.name}<span class="keyboard-shortcut px-3" style="margin-left: auto;"><div class="opacity-80 ui__button-shortcut-key" style="margin-left: 2px;">${i + 1}</div></span>`
                        };
                    }
                    return item;
                })
            );
        }

        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;

            if (UI.getActiveModal() !== modalContext?.modalId) {
                return;
            }

            if (e.key >= "1" && e.key <= "9" && enableKeySelect) {
                const index = parseInt(e.key, 10) - 1;
                if (index < items.length) {
                    handleSelection(index);
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
        };
    }, [open, items, enableKeySelect, handleSelection]);

    React.useEffect(() => {
        if (!open) {
            returnResult(null);
        }
    }, [open, returnResult]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            zDepth="high">
            {message && <h1 className="mb-2 text-2xl p-1">{message}</h1>}
            {displayItems.map((item, index) => (
                <LogseqButton
                    key={index}
                    onClick={() => handleSelection(index)}
                    color="primary"
                    isFullWidth={true}
                    icon={item.icon}>
                    <span
                        style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: 1
                        }}
                        dangerouslySetInnerHTML={{__html: item.name}}
                    />
                </LogseqButton>
            ))}
        </Modal>
    );
};
