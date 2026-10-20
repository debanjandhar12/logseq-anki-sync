import _ from "lodash";
import React, {useCallback, useState} from "react";
import {ANKI_ICON} from "../../../constants";
import {WindowBridge} from "../../../logseq/WindowBridge";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqDropdownMenu} from "../../components/LogseqDropdownMenu";
import {Modal} from "../../modals/core/Modal";
import {DialogModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {CreateLineDisplay, DeleteLineDisplay, UpdateLineDisplay} from "./NoteLineDisplays";
import {SyncSettingsPopover} from "./SyncSettingsPopover";
import {useSyncSelection} from "./useSyncSelection";

function SelectionSection({
    title,
    selection,
    checkbox,
    onToggleAll,
    emptyMessage,
    children
}: {
    title: string;
    selection: boolean[];
    checkbox: string;
    onToggleAll: () => void;
    emptyMessage: string;
    children: React.ReactNode;
}) {
    return (
        <>
            <div
                className="p-4"
                style={{
                    backgroundColor: "var(--ls-tertiary-background-color)",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                    marginTop: "0.5rem",
                    marginBottom: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    userSelect: "none",
                    zIndex: 1
                }}>
                {title}
                <span
                    className="opacity-50 px-1 flex"
                    style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                    {" "}
                    {selection.filter(Boolean).length} / {selection.length}
                    <span style={{width: "15px"}} />
                    <LogseqCheckbox
                        checked={checkbox === "checked"}
                        indeterminate={checkbox === "indeterminate"}
                        onChange={onToggleAll}
                    />
                </span>
            </div>
            {selection.length <= 0 && <span style={{fontSize: "14px"}}>{emptyMessage}</span>}
            {children}
        </>
    );
}

export const SyncSelectionDialogComponent: React.FC<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
    resolve: (
        value: {
            toCreateNotes: Array<any>;
            toUpdateNotes: Array<any>;
            toDeleteNotes: Array<any>;
        } | null
    ) => void;
    reject: (reason?: any) => void;
    modalContext?: {modalId: string | null};
}> = ({toCreateNotes, toUpdateNotes, toDeleteNotes, resolve, modalContext}) => {
    const {open, setOpen, returnResult} = useModal(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false, // We'll handle this manually
        enableEnterKey: false, // We'll handle this manually
        defaultResult: null,
        modalId: modalContext?.modalId
    });
    const {
        toCreateNotesSelection,
        setToCreateNotesSelection,
        toCreateNotesCheckbox,
        handleCreateNotesCheckboxClick,
        toUpdateNotesSelection,
        setToUpdateNotesSelection,
        toUpdateNotesCheckbox,
        handleUpdateNotesCheckboxClick,
        toDeleteNotesSelection,
        setToDeleteNotesSelection,
        toDeleteNotesCheckbox,
        handleDeleteNotesCheckboxClick,
        selectionMenu
    } = useSyncSelection(toCreateNotes, toUpdateNotes, toDeleteNotes);

    const handleConfirm = useCallback(() => {
        returnResult({
            toCreateNotes: toCreateNotesSelection
                .map((selected, index) => (selected ? toCreateNotes[index] : null))
                .filter(Boolean),
            toUpdateNotes: toUpdateNotesSelection
                .map((selected, index) => (selected ? toUpdateNotes[index] : null))
                .filter(Boolean),
            toDeleteNotes: toDeleteNotesSelection
                .map((selected, index) => (selected ? toDeleteNotes[index] : null))
                .filter(Boolean)
        });
    }, [
        returnResult,
        toCreateNotes,
        toUpdateNotes,
        toDeleteNotes,
        toCreateNotesSelection,
        toUpdateNotesSelection,
        toDeleteNotesSelection
    ]);

    const handleCancel = useCallback(() => {
        returnResult(null);
    }, [returnResult]);

    const onKeydown = React.useCallback(
        (e: KeyboardEvent) => {
            if (!open) return;

            if (UI.getActiveModal() !== modalContext?.modalId) {
                return;
            }

            if (e.key === "Escape") {
                handleCancel();
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key === "Enter") {
                handleConfirm();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        },
        [open, handleConfirm, handleCancel, modalContext?.modalId]
    );

    React.useEffect(() => {
        if (open) WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
        };
    }, [open, onKeydown]);

    React.useEffect(() => {
        if (!open) {
            returnResult(null);
        }
    }, [open, returnResult]);

    const [graphName, setGraphName] = useState("");
    React.useEffect(() => {
        const getGraphName = async () => {
            const graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            setGraphName(graphName);
        };
        getGraphName().then();
    }, []);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            hasCloseButton={false}>
            <div style={{margin: "0rem"}}>
                <ModalHeader
                    title="Proceed sync with anki?"
                    icon={ANKI_ICON}
                    onClose={() => setOpen(false)}
                    showCloseButton={true}>
                    <LogseqDropdownMenu menuArr={selectionMenu}>
                        <LogseqButton size={"xs"} color="outline-link">
                            Selection
                        </LogseqButton>
                    </LogseqDropdownMenu>
                </ModalHeader>
                <div
                    className="sm:flex sm:items-start"
                    style={{maxHeight: "60vh", overflowY: "auto", overflowX: "hidden"}}>
                    <div
                        className="mt-3 sm:mt-0 ml-4 mr-4 flex"
                        style={{width: "100%", flexDirection: "column"}}>
                        <SelectionSection
                            title="Create"
                            selection={toCreateNotesSelection}
                            checkbox={toCreateNotesCheckbox}
                            onToggleAll={handleCreateNotesCheckboxClick}
                            emptyMessage="No notes to be created.">
                            {toCreateNotes.map((note, index) => (
                                <LogseqCheckbox
                                    checked={toCreateNotesSelection[index]}
                                    key={note.uuid + note.type}
                                    onChange={() => {
                                        const newToCreateNotesSelection = [
                                            ...toCreateNotesSelection
                                        ];
                                        newToCreateNotesSelection[index] =
                                            !newToCreateNotesSelection[index];
                                        setToCreateNotesSelection(newToCreateNotesSelection);
                                    }}>
                                    <CreateLineDisplay note={note} graphName={graphName} />
                                </LogseqCheckbox>
                            ))}
                        </SelectionSection>
                        <SelectionSection
                            title="Delete"
                            selection={toDeleteNotesSelection}
                            checkbox={toDeleteNotesCheckbox}
                            onToggleAll={handleDeleteNotesCheckboxClick}
                            emptyMessage="No notes to be deleted.">
                            {toDeleteNotes.map((ankiId, index) => (
                                <LogseqCheckbox
                                    key={ankiId}
                                    checked={toDeleteNotesSelection[index]}
                                    onChange={() => {
                                        const newToDeleteNotesSelection = [
                                            ...toDeleteNotesSelection
                                        ];
                                        newToDeleteNotesSelection[index] =
                                            !newToDeleteNotesSelection[index];
                                        setToDeleteNotesSelection(newToDeleteNotesSelection);
                                    }}>
                                    <DeleteLineDisplay ankiId={ankiId} />
                                </LogseqCheckbox>
                            ))}
                        </SelectionSection>
                        <SelectionSection
                            title="Update"
                            selection={toUpdateNotesSelection}
                            checkbox={toUpdateNotesCheckbox}
                            onToggleAll={handleUpdateNotesCheckboxClick}
                            emptyMessage="No notes to be updated.">
                            {toUpdateNotes.map((note, index) => (
                                <LogseqCheckbox
                                    checked={toUpdateNotesSelection[index]}
                                    key={note.uuid + note.type}
                                    onChange={() => {
                                        const newToUpdateNotesSelection = [
                                            ...toUpdateNotesSelection
                                        ];
                                        newToUpdateNotesSelection[index] =
                                            !newToUpdateNotesSelection[index];
                                        setToUpdateNotesSelection(newToUpdateNotesSelection);
                                    }}>
                                    <UpdateLineDisplay note={note} graphName={graphName} />
                                </LogseqCheckbox>
                            ))}
                        </SelectionSection>
                    </div>
                </div>
                <DialogModalFooter
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmText="Confirm"
                    cancelText="Cancel">
                    <SyncSettingsPopover />
                </DialogModalFooter>
            </div>
        </Modal>
    );
};
