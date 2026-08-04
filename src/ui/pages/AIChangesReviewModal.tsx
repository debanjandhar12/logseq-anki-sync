import type React from "react";
import {DiffViewer} from "src/chat-app/components/DiffViewer";
import {Modal} from "../modals/core/Modal";
import {ModalFooter} from "../modals/core/ModalFooter";
import {ModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export interface AIChangesReviewModalProps {
    beforeChanges: string;
    afterChanges: string;
    resolve: (value: boolean | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const AIChangesReviewModalComponent: React.FC<AIChangesReviewModalProps> = ({
    beforeChanges,
    afterChanges,
    resolve,
    modalContext
}) => {
    const {open, setOpen, handleConfirm, handleCancel} = useModal<boolean | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        enableEnterKey: true,
        enableOutsideClickClose: false,
        defaultResult: false,
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
                    title="Review changes"
                    onClose={() => handleCancel()}
                    showCloseButton={true}
                />
                <p className="mx-4 my-3 text-sm opacity-80">
                    Review these changes before committing them.
                </p>

                <div className="mx-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    {beforeChanges === afterChanges ? (
                        <div className="rounded border border-border bg-primary-background p-4 text-sm opacity-80">
                            No changes ready to review were found.
                        </div>
                    ) : (
                        <DiffViewer
                            oldFile={{content: beforeChanges, name: "Before"}}
                            newFile={{content: afterChanges, name: "After"}}
                            viewMode="split"
                            size="sm"
                            showLineNumbers={false}
                            showIcon={false}
                            variant="ghost"
                            className="rounded border border-border bg-secondary-background"
                            contentClassName="max-h-[60vh] overflow-auto"
                        />
                    )}
                </div>

                <ModalFooter
                    onConfirm={() => handleConfirm(true)}
                    onCancel={() => handleConfirm(false)}
                    confirmText="Commit changes"
                    cancelText="Discard review changes"
                    cancelColor="failed"
                    confirmShortcut=""
                    className="border-border border-t px-4 pb-4 pt-3"
                />
            </div>
        </Modal>
    );
};
