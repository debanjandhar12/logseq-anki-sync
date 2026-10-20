import _ from "lodash";
import React, {useState} from "react";
import {ANKI_ICON} from "../../../constants";
import type {SyncResult} from "../../../sync/types";
import {Modal} from "../../modals/core/Modal";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {
    CreateLineDisplay,
    type DisplayNote,
    UpdateLineDisplay
} from "../SyncSelectionDialog/NoteLineDisplays";
import {DeletedNotesSection} from "./DeletedNotesSection";
import {ResultSectionHeading} from "./ResultSectionHeading";
import {SyncErrorDetailsLink} from "./SyncErrorDetailsLink";
import {parseFailedNoteKey} from "./utils/parseFailedNoteKey";

function NoteResultsSection({
    kind,
    notes,
    failures,
    graphName
}: {
    kind: "Created" | "Updated";
    notes: DisplayNote[];
    failures: Record<string, Error>;
    graphName: string;
}) {
    const FailureLineDisplay = kind === "Created" ? CreateLineDisplay : UpdateLineDisplay;
    return (
        <>
            <ResultSectionHeading title={kind} />
            {notes.length <= 0 && (
                <span style={{fontSize: "14px"}}>No notes were {kind.toLowerCase()}.</span>
            )}
            {notes.map((note) =>
                failures[`${note.uuid}-${note.type}`] ? null : (
                    <span className="inline-flex items-center" key={note.uuid + note.type}>
                        <span
                            style={{
                                fontSize: "14px",
                                color: "var(--amplify-colors-font-success)",
                                userSelect: "none"
                            }}
                            title="Synced Successfully">
                            ✓
                        </span>
                        <UpdateLineDisplay note={note} graphName={graphName} />
                        {kind === "Created" ? " " : null}
                    </span>
                )
            )}
            {Object.keys(failures).map((key) => {
                const note = parseFailedNoteKey(key);
                return (
                    <span className="inline-flex items-center" key={note.uuid + note.type}>
                        <span
                            style={{
                                fontSize: "14px",
                                color: "var(--amplify-colors-font-error)",
                                userSelect: "none"
                            }}
                            title="Sync Failed">
                            ⚠
                        </span>
                        <FailureLineDisplay note={note} graphName={graphName} />
                        <SyncErrorDetailsLink noteKey={key} error={failures[key]} />
                    </span>
                );
            })}
        </>
    );
}

export interface SyncResultDialogProps {
    syncResult: SyncResult;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const SyncResultDialogComponent: React.FC<SyncResultDialogProps> = ({
    syncResult,
    resolve,
    modalContext
}) => {
    const {
        toCreateNotes,
        toUpdateNotes,
        toDeleteNotes,
        failedCreated,
        failedUpdated,
        failedDeleted
    } = syncResult;
    const {open, setOpen} = useModal(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: true,
        defaultResult: null,
        modalId: modalContext?.modalId
    });
    const [graphName, setGraphName] = useState("");
    React.useEffect(() => {
        const getGraphName = async () =>
            setGraphName(_.get(await logseq.App.getCurrentGraph(), "name") || "Default");
        void getGraphName();
    }, []);
    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            hasCloseButton={false}>
            <div style={{margin: "0rem"}}>
                <ModalHeader
                    title="Sync Result Details"
                    icon={ANKI_ICON}
                    onClose={() => setOpen(false)}
                    showCloseButton={true}
                />
                <div
                    className="sm:flex sm:items-start"
                    style={{maxHeight: "60vh", overflowY: "auto", overflowX: "hidden"}}>
                    <div
                        className="mt-3 sm:mt-0 ml-4 mr-4 flex"
                        style={{width: "100%", flexDirection: "column"}}>
                        <NoteResultsSection
                            kind="Created"
                            notes={toCreateNotes}
                            failures={failedCreated}
                            graphName={graphName}
                        />
                        <DeletedNotesSection
                            deletedNotes={toDeleteNotes}
                            failures={failedDeleted}
                        />
                        <NoteResultsSection
                            kind="Updated"
                            notes={toUpdateNotes}
                            failures={failedUpdated}
                            graphName={graphName}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
