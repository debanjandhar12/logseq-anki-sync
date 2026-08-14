import {
    autoUpdate,
    flip,
    offset,
    shift,
    size,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useListNavigation,
    useRole
} from "@floating-ui/react";
import {CheckIcon, ChevronDownIcon} from "lucide-react";
import React from "react";
import {DiffViewer} from "src/chat-app/components/DiffViewer";
import {getLogseqAttachmentIcon} from "src/chat-app/utils/getLogseqAttachmentIcon";
import type {LogseqPrintedPageChange} from "src/core/logseq-reversible-transaction-tracker";
import {LogseqButton} from "../components/LogseqButton";
import {Modal} from "../modals/core/Modal";
import {ModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export type AIChangesReviewResult = "commit" | "discard" | "defer-commit" | null;
type AIChangesReviewAction = Exclude<AIChangesReviewResult, null>;

const AI_CHANGES_REVIEW_ACTIONS: ReadonlyArray<{
    value: AIChangesReviewAction;
    label: string;
    colorClassName: string;
    activeClassName: string;
}> = [
    {
        value: "commit",
        label: "Approve and Commit",
        colorClassName: "text-green-600 dark:text-green-400",
        activeClassName: "bg-green-500/10"
    },
    {
        value: "discard",
        label: "Reject and Revert Changes",
        colorClassName: "text-red-600 dark:text-red-400",
        activeClassName: "bg-red-500/10"
    },
    {
        value: "defer-commit",
        label: "Defer Commit",
        colorClassName: "text-amber-600 dark:text-amber-400",
        activeClassName: "bg-amber-500/10"
    }
];

export interface AIChangesReviewModalProps {
    changes: LogseqPrintedPageChange[];
    resolve: (value: AIChangesReviewResult) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export function createAIChangesReviewDiffViewers(
    changes: LogseqPrintedPageChange[]
): React.ReactElement[] {
    return changes.map((change) => {
        const pageType = change.before.pageType ?? change.after.pageType;
        return (
            <DiffViewer
                key={change.key}
                oldFile={{
                    name: change.before.pageName,
                    content: change.before.content
                }}
                newFile={{
                    name: change.after.pageName,
                    content: change.after.content
                }}
                language="markdown"
                viewMode="split"
                size="sm"
                showLineNumbers={false}
                showIcon={true}
                fileIcon={getLogseqAttachmentIcon(pageType)}
                showStats={true}
                variant="ghost"
                className="rounded border border-border bg-secondary-background"
                contentClassName="max-h-[60vh] overflow-auto"
            />
        );
    });
}

export const AIChangesReviewModalComponent: React.FC<AIChangesReviewModalProps> = ({
    changes,
    resolve,
    modalContext
}) => {
    const {open, setOpen, handleConfirm, handleCancel} = useModal<AIChangesReviewResult>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableEnterKey: false,
        enableOutsideClickClose: false,
        modalId: modalContext?.modalId
    });

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => {
                handleCancel();
                UI.hideModal(modalContext?.modalId);
            }}
            size="large"
            zDepth="high"
            hasCloseButton={false}
            className="overflow-hidden">
            <div className="flex max-h-[90vh] flex-col text-text">
                <ModalHeader
                    title="Review uncommitted changes"
                    onClose={() => handleCancel()}
                    showCloseButton={true}
                />
                <p className="mx-4 my-3 text-sm opacity-80">
                    Review the uncommitted changes before committing them.
                </p>

                <div className="mx-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {createAIChangesReviewDiffViewers(changes)}
                </div>

                <AIChangesReviewModalFooter onConfirm={(action) => handleConfirm(action)} />
            </div>
        </Modal>
    );
};

export const AIChangesReviewModalFooter: React.FC<{
    onConfirm: (action: AIChangesReviewAction) => void;
}> = ({onConfirm}) => {
    const [selectedAction, setSelectedAction] = React.useState<AIChangesReviewAction>("commit");

    return (
        <div className="mt-3 flex flex-col border-border border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-0">
                <AIChangesReviewActionSelect value={selectedAction} onChange={setSelectedAction} />
                <LogseqButton
                    color="primary"
                    isFullWidth={true}
                    onClick={() => onConfirm(selectedAction)}>
                    Confirm
                </LogseqButton>
            </div>
        </div>
    );
};

const AIChangesReviewActionSelect: React.FC<{
    value: AIChangesReviewAction;
    onChange: (action: AIChangesReviewAction) => void;
}> = ({value, onChange}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedIndex = AI_CHANGES_REVIEW_ACTIONS.findIndex((option) => option.value === value);
    const [activeIndex, setActiveIndex] = React.useState<number | null>(selectedIndex);
    const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const listboxId = React.useId();
    const selectedOption = AI_CHANGES_REVIEW_ACTIONS[selectedIndex];
    const {refs, floatingStyles, context, placement} = useFloating({
        open: isOpen,
        onOpenChange: (open) => {
            setIsOpen(open);
            if (open) setActiveIndex(selectedIndex);
        },
        placement: "top-start",
        strategy: "fixed",
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(4),
            flip(),
            shift({padding: 8}),
            size({
                apply({availableHeight, rects, elements}) {
                    Object.assign(elements.floating.style, {
                        maxHeight: `${Math.max(0, availableHeight)}px`,
                        minWidth: `${rects.reference.width}px`
                    });
                }
            })
        ]
    });
    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, {role: "listbox"});
    const navigation = useListNavigation(context, {
        listRef: itemRefs,
        activeIndex,
        selectedIndex,
        onNavigate: setActiveIndex,
        focusItemOnOpen: true,
        loop: true
    });
    const {getReferenceProps, getFloatingProps, getItemProps} = useInteractions([
        click,
        dismiss,
        role,
        navigation
    ]);

    const selectAction = (action: AIChangesReviewAction) => {
        onChange(action);
        setIsOpen(false);
        (refs.domReference.current as HTMLElement | null)?.focus();
    };

    return (
        <div className="relative m-1 min-w-0 sm:w-60">
            <button
                ref={refs.setReference}
                type="button"
                aria-label="Review action"
                aria-controls={listboxId}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className={`flex h-7 w-full items-center justify-between gap-2 rounded border border-border bg-secondary-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedOption.colorClassName}`}
                {...getReferenceProps({
                    onKeyDown: (event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.stopPropagation();
                        }
                    }
                })}>
                <span className="truncate">{selectedOption.label}</span>
                <ChevronDownIcon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" />
            </button>
            {isOpen && (
                <div
                    ref={refs.setFloating}
                    id={listboxId}
                    role="listbox"
                    aria-label="Review action"
                    data-placement={placement}
                    className="z-[10000] overflow-y-auto rounded border border-border bg-secondary-background p-1 shadow-lg"
                    style={floatingStyles}
                    {...getFloatingProps({
                        onBlur: (event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                setIsOpen(false);
                            }
                        },
                        onKeyDown: (event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                setIsOpen(false);
                                (refs.domReference.current as HTMLElement | null)?.focus();
                            }
                            if (
                                [
                                    "ArrowDown",
                                    "ArrowUp",
                                    "Enter",
                                    " ",
                                    "Escape",
                                    "Home",
                                    "End"
                                ].includes(event.key)
                            ) {
                                event.stopPropagation();
                            }
                        }
                    })}>
                    {AI_CHANGES_REVIEW_ACTIONS.map((option, index) => (
                        <button
                            key={option.value}
                            ref={(node) => {
                                itemRefs.current[index] = node;
                            }}
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            tabIndex={activeIndex === index ? 0 : -1}
                            className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm outline-none ${option.colorClassName} ${
                                activeIndex === index ? option.activeClassName : "hover:bg-tertiary"
                            }`}
                            {...getItemProps({
                                onClick: () => selectAction(option.value),
                                onKeyDown: (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        selectAction(option.value);
                                    }
                                }
                            })}>
                            <span>{option.label}</span>
                            {option.value === value && (
                                <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
