import React from "react";
import {LogseqInMemoryDataPrinter} from "src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter";
import type {
    InMemoryDB,
    InMemoryPageEntity
} from "src/core/logseq-fakeable-transaction-tracker/types";
import {DiffViewer} from "src/shadcn/assistant-ui/diff-viewer";
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

type PageChange = {
    uuid: string;
    title: string;
    status: "created" | "deleted" | "modified";
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
    const [isOpen, setIsOpen] = React.useState(true);
    const statusLabel = getStatusLabel(change.status);

    return (
        <section className="overflow-hidden rounded border border-border bg-secondary-background">
            <button
                type="button"
                className="flex w-full items-center gap-2 border-border border-b bg-transparent px-3 py-2 text-left text-text"
                onClick={() => setIsOpen((current) => !current)}>
                <span className="w-4 shrink-0 text-center opacity-70">{isOpen ? "▾" : "▸"}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{change.title}</span>
                <span className="rounded bg-tertiary px-2 py-0.5 text-xs uppercase opacity-80">
                    {statusLabel}
                </span>
            </button>
            {isOpen && (
                <DiffViewer
                    oldFile={{content: change.originalContent, name: `${change.title} (before)`}}
                    newFile={{content: change.currentContent, name: `${change.title} (after)`}}
                    viewMode="split"
                    size="sm"
                    variant="ghost"
                    className="max-h-96 overflow-auto rounded-none"
                />
            )}
        </section>
    );
}

function getPageChanges(
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

    if (originalContent === currentContent) return null;

    return {
        uuid,
        title: getPageTitle(currentPage ?? originalPage),
        status: getPageStatus(originalPage, currentPage),
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

function getStatusLabel(status: PageChange["status"]): string {
    if (status === "created") return "new";
    if (status === "deleted") return "deleted";
    return "modified";
}
