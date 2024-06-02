import React, {useEffect, useState} from "react";
import {Modal} from "../general/Modal";
import ReactDOM from "react-dom";
import {ANKI_ICON} from "../../constants";
import _ from "lodash";
import {CreateLineDisplay, UpdateLineDisplay} from "./SyncSelectionDialog";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {UI} from "../UI";

export async function SyncResultDialog(
    createdNotes: Array<any>,
    updatedNotes: Array<any>,
    deletedNotes: Array<any>,
    failedCreated: { [key: string]: string },
    failedUpdated: { [key: string]: string },
    failedDeleted: { [key: string]: string },
): Promise<{
    createdNotes: Array<any>;
    updatedNotes: Array<any>;
    deletedNotes: Array<any>;
    failedCreated: { [key: string]: string };
    failedUpdated: { [key: string]: string };
    failedDeleted: { [key: string]: string };
} | null> {
    return new Promise<{
        createdNotes: Array<any>;
        updatedNotes: Array<any>;
        deletedNotes: Array<any>;
        failedCreated: { [key: string]: string };
        failedUpdated: { [key: string]: string };
        failedDeleted: { [key: string]: string };
    } | null>(async (resolve, reject) => {
        try {
            let {key, onClose} = await UI.getEventHandlersForMountedReactComponent(await logseq.Editor.newBlockUUID());
            onClose = onClose.bind(this);
            await UI.mountReactComponentInLogseq(key, '#root main',
                <SyncResultDialogComponent
                    createdNotes={createdNotes}
                    updatedNotes={updatedNotes}
                    deletedNotes={deletedNotes}
                    failedCreated={failedCreated}
                    failedUpdated={failedUpdated}
                    failedDeleted={failedDeleted}
                    onClose={onClose}
                />);
        } catch (e) {
            await logseq.UI.showMsg(e, "error");
            console.log(e);
            reject(e);
        }
    });
}

const SyncResultDialogComponent: React.FC<{
    createdNotes: Array<any>;
    updatedNotes: Array<any>;
    deletedNotes: Array<any>;
    failedCreated: { [key: string]: string };
    failedUpdated: { [key: string]: string };
    failedDeleted: { [key: string]: string };
    onClose: () => void;
}> = ({
    createdNotes,
    updatedNotes,
    deletedNotes,
    failedCreated,
    failedUpdated,
    failedDeleted,
    onClose,
}) => {
    const [open, setOpen] = useState(true);

    const onKeydown = React.useCallback((e: KeyboardEvent) => {
        if (!open) return;
        if (e.key === "Escape") {
            onClose();
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, []);

    React.useEffect(() => {
        if (open) window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open]);

    const [graphName, setGraphName] = useState("");
    React.useEffect(() => {
        const getGraphName = async () => {
            const graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            setGraphName(graphName);
        };
        getGraphName().then();
    }, []);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} hasCloseButton={false}>
            <div className="settings-modal of-plugins pb-2">
                <div className="absolute top-0 right-0 pt-2 pr-2">
                    <button
                        aria-label="Close"
                        type="button"
                        className="ui__modal-close opacity-60 hover:opacity-100"
                        onClick={() => setOpen(false)}>
                        <svg
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6">
                            <path
                                d="M6 18L18 6M6 6l12 12"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"></path>
                        </svg>
                    </button>
                </div>
                <header
                    style={{
                        borderBottom: "1px solid var(--ls-border-color)",
                        padding: "8px 12px",
                    }}>
                    <h3 className="title inline-flex items-center" style={{marginTop: "2px"}}>
                        <i className="px-1" dangerouslySetInnerHTML={{__html: ANKI_ICON}}></i>{" "}
                        <strong>Sync Result Details</strong>
                    </h3>
                </header>
                <div
                    className="sm:flex sm:items-start"
                    style={{maxHeight: "70vh", overflowY: "auto", overflowX: "hidden"}}>
                    <div
                        className="mt-3 sm:mt-0 ml-4 mr-4 flex"
                        style={{width: "100%", flexDirection: "column"}}>
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
                                zIndex: 1,
                            }}>
                            Created
                        </div>
                        {createdNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes were created.</span>
                        )}
                        {createdNotes.map((note, index) => (
                            <span
                                className="inline-flex items-center"
                                key={note.uuid + note.type}>
                                <span
                                    style={{
                                        fontSize: "14px",
                                        color: "var(--ls-success-color)",
                                        userSelect: "none",
                                    }}
                                    title={"Synced Successfully"}>
                                    ✓
                                </span>
                                <UpdateLineDisplay note={note} graphName={graphName} />{" "}
                                {/* Use update line display for created notes */}
                            </span>
                        ))}
                        {Object.keys(failedCreated).map((noteUuidTypeStr, index) => {
                            const uuid = noteUuidTypeStr.substring(
                                0,
                                noteUuidTypeStr.lastIndexOf("-"),
                            );
                            const type = noteUuidTypeStr.substring(
                                noteUuidTypeStr.lastIndexOf("-") + 1,
                            );
                            return (
                                <span className="inline-flex items-center" key={uuid + type}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--ls-error-color)",
                                            userSelect: "none",
                                        }}
                                        title={"Sync Failed"}>
                                        ⚠
                                    </span>
                                    <CreateLineDisplay
                                        note={{uuid, type}}
                                        graphName={graphName}
                                    />
                                    <a style={{fontSize: '14px', marginLeft: '5px'}} onClick={
                                        () => logseq.UI.showMsg(failedCreated[noteUuidTypeStr].toString()
                                            , 'warning', {timeout: 0})
                                    }>(show error details)</a>
                                </span>
                            );
                        })}
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
                                zIndex: 1,
                            }}>
                            Deleted
                        </div>
                        <span style={{fontSize: "14px"}}>
                            {deletedNotes.length > 0
                                ? `The ${deletedNotes.length} notes were deleted successfully`
                                : `No notes were deleted.`}
                            {Object.keys(failedDeleted).length > 0
                                ? `The ${Object.keys(failedDeleted).length} notes failed to delete`
                                : ``}
                        </span>
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
                                zIndex: 1,
                            }}>
                            Updated
                        </div>
                        {updatedNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes were updated.</span>
                        )}
                        {updatedNotes.map((note, index) => (
                            <span
                                className="inline-flex items-center"
                                key={note.uuid + note.type}>
                                <span
                                    style={{
                                        fontSize: "14px",
                                        color: "var(--ls-success-color)",
                                        userSelect: "none",
                                    }}
                                    title={"Synced Successfully"}>
                                    ✓
                                </span>
                                <UpdateLineDisplay note={note} graphName={graphName} />
                            </span>
                        ))}
                        {Object.keys(failedUpdated).map((noteUuidTypeStr, index) => {
                            const uuid = noteUuidTypeStr.substring(
                                0,
                                noteUuidTypeStr.lastIndexOf("-"),
                            );
                            const type = noteUuidTypeStr.substring(
                                noteUuidTypeStr.lastIndexOf("-") + 1,
                            );
                            return (
                                <span className="inline-flex items-center" key={uuid + type}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--ls-error-color)",
                                            userSelect: "none",
                                        }}
                                        title={"Sync Failed"}>
                                        ⚠
                                    </span>
                                    <UpdateLineDisplay
                                        note={{uuid, type}}
                                        graphName={graphName}
                                    />
                                    <a style={{fontSize: '14px', marginLeft: '5px'}} onClick={
                                        () => logseq.UI.showMsg(failedUpdated[noteUuidTypeStr].toString()
                                            , 'warning', {timeout: 0})
                                    }>(show error details)</a>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
