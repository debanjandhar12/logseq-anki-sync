import type React from "react";
import {DiffViewer} from "src/chat-app/components/DiffViewer";
import {getLogseqAttachmentIcon} from "src/chat-app/utils/getLogseqAttachmentIcon";
import type {LogseqPrintedPageChange} from "src/core/logseq-reversible-transaction-tracker";
import {LogseqButton} from "../components/LogseqButton";
import {Modal} from "../modals/core/Modal";
import {ModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export type AIChangesReviewResult = "commit" | "discard" | "continue-later" | null;

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
        enableEnterKey: true,
        enableOutsideClickClose: false,
        defaultResult: "discard",
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

                <AIChangesReviewModalFooter
                    onContinue={() => handleConfirm("continue-later")}
                    onDiscard={() => handleConfirm("discard")}
                    onCommit={() => handleConfirm("commit")}
                />
            </div>
        </Modal>
    );
};

export const AIChangesReviewModalFooter: React.FC<{
    onContinue: () => void;
    onDiscard: () => void;
    onCommit: () => void;
}> = ({onContinue, onDiscard, onCommit}) => (
    <div className="mt-5 flex flex-col border-border border-t px-4 pb-4 pt-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:-ml-3">
            <LogseqButton color="ghost" isFullWidth={true} onClick={onContinue}>
                Continue (Commit Later)
            </LogseqButton>
        </div>
        <div className="flex flex-col sm:flex-row-reverse">
            <LogseqButton color="primary" isFullWidth={true} onClick={onCommit}>
                Commit changes
            </LogseqButton>
            <LogseqButton color="failed" isFullWidth={true} onClick={onDiscard}>
                Discard uncommitted changes
            </LogseqButton>
        </div>
    </div>
);
