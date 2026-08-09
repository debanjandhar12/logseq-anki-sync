import type React from "react";
import {DiffViewer} from "src/chat-app/components/DiffViewer";
import type {LogseqPrintedPageChange} from "src/core/logseq-reversible-transaction-tracker";
import {Modal} from "../modals/core/Modal";
import {ModalFooter} from "../modals/core/ModalFooter";
import {ModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export interface AIChangesReviewModalProps {
    changes: LogseqPrintedPageChange[];
    resolve: (value: boolean | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export function createAIChangesReviewDiffViewers(
    changes: LogseqPrintedPageChange[]
): React.ReactElement[] {
    return changes.map((change) => (
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
            showIcon={false}
            showStats={true}
            variant="ghost"
            className="rounded border border-border bg-secondary-background"
            contentClassName="max-h-[60vh] overflow-auto"
        />
    ));
}

export const AIChangesReviewModalComponent: React.FC<AIChangesReviewModalProps> = ({
    changes,
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

                <ModalFooter
                    onConfirm={() => handleConfirm(true)}
                    onCancel={() => handleConfirm(false)}
                    confirmText="Commit changes"
                    cancelText="Discard uncommitted changes"
                    cancelColor="failed"
                    confirmShortcut=""
                    className="border-border border-t px-4 pb-4 pt-3"
                />
            </div>
        </Modal>
    );
};
