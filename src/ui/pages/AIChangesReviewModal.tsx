import React from "react";
import {DiffViewer} from "src/chat-app/components/DiffViewer";
import {LogseqInMemoryDataPrinter} from "src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter";
import type {
    InMemoryDB,
    InMemoryPageEntity
} from "src/core/logseq-fakeable-transaction-tracker/types";
import {LogseqButton} from "../components/LogseqButton";
import {Modal} from "../modals/core/Modal";
import {SimpleModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

export interface AIChangesReviewModalProps {
    currentPageDataDb: InMemoryDB;
    originalPageDataDb: InMemoryDB;
    resolve: (value: boolean | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export type PageChange = {
    uuid: string;
    title: string;
    status: "created" | "deleted" | "modified";
    originalTitle?: string;
    currentTitle?: string;
    originalContent: string;
    currentContent: string;
};

export const AIChangesReviewModalComponent: React.FC<AIChangesReviewModalProps> = ({
    currentPageDataDb,
    originalPageDataDb,
    resolve,
    modalContext
}) => {
    const changes = React.useMemo(
        () => getPageChanges(currentPageDataDb, originalPageDataDb),
        [currentPageDataDb, originalPageDataDb]
    );

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
            hasCloseButton={true}
            className="overflow-hidden">
            <div className="flex max-h-[90vh] flex-col p-4 text-text">
                <SimpleModalHeader title="Review AI Changes" />
                <p className="mb-4 text-sm opacity-80">
                    Review the pending Logseq graph changes before applying them.
                </p>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {changes.length === 0 ? (
                        <div className="rounded border border-border bg-primary-background p-4 text-sm opacity-80">
                            No pending page changes were found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {changes.map((change) => (
                                <PageChangePreview key={change.uuid} change={change} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex flex-row-reverse gap-2 border-border border-t pt-3">
                    <LogseqButton onClick={() => handleConfirm(true)} color="primary">
                        Apply changes
                    </LogseqButton>
                    <LogseqButton onClick={() => handleConfirm(false)} color="failed">
                        Reject changes
                    </LogseqButton>
                </div>
            </div>
        </Modal>
    );
};

function PageChangePreview({change}: {change: PageChange}) {
    return (
        <section>
            <DiffViewer
                oldFile={{content: change.originalContent, name: change.originalTitle}}
                newFile={{content: change.currentContent, name: change.currentTitle}}
                viewMode="split"
                size="sm"
                showLineNumbers={false}
                showIcon={false}
                variant="ghost"
                className="rounded border border-border bg-secondary-background"
                contentClassName="max-h-96 overflow-auto"
            />
        </section>
    );
}

export function getPageChanges(
    currentPageDataDb: InMemoryDB,
    originalPageDataDb: InMemoryDB
): PageChange[] {
    const pageUUIDs = new Set([...originalPageDataDb.keys(), ...currentPageDataDb.keys()]);

    return Array.from(pageUUIDs)
        .map((uuid) => getPageChange(uuid, currentPageDataDb, originalPageDataDb))
        .filter((change): change is PageChange => change !== null)
        .sort((a, b) => a.title.localeCompare(b.title));
}

function getPageChange(
    uuid: string,
    currentPageDataDb: InMemoryDB,
    originalPageDataDb: InMemoryDB
): PageChange | null {
    const originalPage = originalPageDataDb.get(uuid);
    const currentPage = currentPageDataDb.get(uuid);
    const originalContent = originalPage ? printPage(uuid, originalPage) : "";
    const currentContent = currentPage ? printPage(uuid, currentPage) : "";
    const originalTitle = originalPage ? getPageTitle(originalPage) : undefined;
    const currentTitle = currentPage ? getPageTitle(currentPage) : undefined;
    const hasPagePresenceChanged = (originalPage === undefined) !== (currentPage === undefined);

    if (
        !hasPagePresenceChanged &&
        originalTitle === currentTitle &&
        originalContent === currentContent
    ) {
        return null;
    }

    return {
        uuid,
        title: getPageTitle(currentPage ?? originalPage),
        status: getPageStatus(originalPage, currentPage),
        originalTitle,
        currentTitle,
        originalContent,
        currentContent
    };
}

function printPage(uuid: string, page: InMemoryPageEntity): string {
    return LogseqInMemoryDataPrinter.print(new Map([[uuid, page]]));
}

function getPageTitle(page: InMemoryPageEntity | undefined): string {
    return page?.title || page?.name || "Untitled page";
}

function getPageStatus(
    originalPage: InMemoryPageEntity | undefined,
    currentPage: InMemoryPageEntity | undefined
): PageChange["status"] {
    if (!originalPage) return "created";
    if (!currentPage) return "deleted";
    return "modified";
}
