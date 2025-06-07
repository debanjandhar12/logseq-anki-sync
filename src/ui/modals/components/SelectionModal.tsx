import React from "../../React";
import { Modal } from "../Modal";
import { useModal } from "../hooks/useModal";
import { LogseqButton } from "../../common/LogseqButton";
import { createModalPromise } from "../utils/createModalPromise";

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
    onClose: () => void;
}

const SelectionModalComponent: React.FC<SelectionModalProps> = ({
    items,
    message,
    enableKeySelect = false,
    resolve,
    reject,
    onClose,
}) => {
    const [displayItems, setDisplayItems] = React.useState(items);
    
    const { open, setOpen, returnResult } = useModal<number | null>(resolve, {
        onClose,
        enableEscapeKey: true,
        defaultResult: null,
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
                            name: `${item.name}<span class="keyboard-shortcut px-3"><div class="opacity-80 ui__button-shortcut-key" style="margin-left: 2px;">${i + 1}</div></span>`,
                        };
                    }
                    return item;
                })
            );
        }

        const onKeydown = (e: KeyboardEvent) => {
            if (!open) return;
            
            if (e.key === "Escape") {
                handleSelection(null);
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key >= "1" && e.key <= "9" && enableKeySelect) {
                const index = parseInt(e.key) - 1;
                if (index < items.length) {
                    handleSelection(index);
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        };

        window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open, items, enableKeySelect, handleSelection]);

    React.useEffect(() => {
        if (!open) {
            returnResult(null);
        }
    }, [open, returnResult]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} zDepth="high">
            {message && <h1 className="mb-4 text-2xl p-1">{message}</h1>}
            {displayItems.map((item, index) => (
                <LogseqButton
                    key={index}
                    onClick={() => handleSelection(index)}
                    color="primary"
                    isFullWidth={true}
                    icon={item.icon}
                >
                    <span
                        style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                        dangerouslySetInnerHTML={{ __html: item.name }}
                    />
                </LogseqButton>
            ))}
        </Modal>
    );
};

/**
 * Enhanced selection modal with standardized API
 */
export async function showSelectionModal(
    items: SelectionModalItem[],
    options: {
        message?: string;
        enableKeySelect?: boolean;
    } = {}
): Promise<number | null> {
    return createModalPromise<number | null>(
        (props) => (
            <SelectionModalComponent
                items={items}
                message={options.message}
                enableKeySelect={options.enableKeySelect}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open selection modal" }
    );
}
