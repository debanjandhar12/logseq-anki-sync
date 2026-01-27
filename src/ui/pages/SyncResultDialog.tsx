import React, {useState} from "../React";
import {ANKI_ICON} from "../../constants";
import _ from "lodash";
import {CreateLineDisplay, UpdateLineDisplay} from "./SyncSelectionDialog";
import { createModalPromise, Modal, ModalHeader, useModal } from "../";
import { UI } from "../UI";

import { createLogger, LoggerCategory } from "../../utils/logger";

const logger = createLogger(LoggerCategory.Others);

export async function showSyncResultDialog(
    createdNotes: Array<any>,
    updatedNotes: Array<any>,
    deletedNotes: Array<any>,
    failedCreated: { [key: string]: Error },
    failedUpdated: { [key: string]: Error },
    failedDeleted: { [key: string]: Error },
): Promise<{
    createdNotes: Array<any>;
    updatedNotes: Array<any>;
    deletedNotes: Array<any>;
    failedCreated: { [key: string]: Error };
    failedUpdated: { [key: string]: Error };
    failedDeleted: { [key: string]: Error };
} | null> {
    return createModalPromise<{
        createdNotes: Array<any>;
        updatedNotes: Array<any>;
        deletedNotes: Array<any>;
        failedCreated: { [key: string]: Error };
        failedUpdated: { [key: string]: Error };
        failedDeleted: { [key: string]: Error };
    } | null>(
        (props) => (
            <SyncResultDialogComponent
                createdNotes={createdNotes}
                updatedNotes={updatedNotes}
                deletedNotes={deletedNotes}
                failedCreated={failedCreated}
                failedUpdated={failedUpdated}
                failedDeleted={failedDeleted}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open sync result dialog" }
    );
}

const SyncResultDialogComponent: React.FC<{
    createdNotes: Array<any>;
    updatedNotes: Array<any>;
    deletedNotes: Array<any>;
    failedCreated: { [key: string]: Error };
    failedUpdated: { [key: string]: Error };
    failedDeleted: { [key: string]: Error };
    resolve: (value: any) => void;
    reject: (error: any) => void;
}> = ({
    createdNotes,
    updatedNotes,
    deletedNotes,
    failedCreated,
    failedUpdated,
    failedDeleted,
    resolve,
    reject,
}) => {
    const { open, setOpen } = useModal(resolve, {
        onClose: () => UI.hideModal(),
        enableEscapeKey: true,
        defaultResult: null,
    });

    const [graphName, setGraphName] = useState("");
    React.useEffect(() => {
        const getGraphName = async () => {
            const graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            setGraphName(graphName);
        };
        getGraphName().then();
    }, []);

    return (
        <Modal open={open} setOpen={setOpen} onClose={() => UI.hideModal()} hasCloseButton={false}>
            <div style={{margin: '0rem'}}>
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
                        {createdNotes.map((note) =>
                            failedCreated[note.uuid + "-" + note.type] ? null : (
                            <span
                                className="inline-flex items-center"
                                key={note.uuid + note.type}>
                                <span
                                    style={{
                                        fontSize: "14px",
                                        color: "var(--amplify-colors-font-success)",
                                        userSelect: "none",
                                    }}
                                    title={"Synced Successfully"}>
                                    ✓
                                </span>
                                <UpdateLineDisplay note={note} graphName={graphName} />{" "}
                                {/* Use update line display for created notes */}
                            </span>
                        ))}
                        {Object.keys(failedCreated).map((noteUuidTypeStr) => {
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
                                            color: "var(--amplify-colors-font-error)",
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
                                        () => {
                                            const error = failedCreated[noteUuidTypeStr];
                                            logger.info(`Error object for ${noteUuidTypeStr}:`, error);
                                            const errorMessage = `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`;
                                            logseq.UI.showMsg(errorMessage, 'warning', {timeout: 0});
                                        }
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
                                ?
                                <span>
                                    The ${Object.keys(failedDeleted).length} notes failed to delete
                                    <a style={{fontSize: '14px', marginLeft: '5px'}} onClick={
                                        () => {
                                            logger.info(`Error object for all failed deletes:`, failedDeleted);
                                            const errorMessage = `${JSON.stringify(failedDeleted)}`;
                                            logseq.UI.showMsg(errorMessage, 'warning', {timeout: 0});
                                        }
                                    }>(show error details)</a>
                                </span>
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
                        {updatedNotes.map((note) => (
                            failedUpdated[note.uuid + "-" + note.type] ? null : <span
                                className="inline-flex items-center"
                                key={note.uuid + note.type}>
                                <span
                                    style={{
                                        fontSize: "14px",
                                        color: "var(--amplify-colors-font-success)",
                                        userSelect: "none",
                                    }}
                                    title={"Synced Successfully"}>
                                    ✓
                                </span>
                                <UpdateLineDisplay note={note} graphName={graphName} />
                            </span>
                        ))}
                        {Object.keys(failedUpdated).map((noteUuidTypeStr) => {
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
                                            color: "var(--amplify-colors-font-error)",
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
                                        () => {
                                            const error = failedUpdated[noteUuidTypeStr];
                                            logger.info(`Error object for ${noteUuidTypeStr}:`, error);
                                            const errorMessage = `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`;
                                            logseq.UI.showMsg(errorMessage, 'warning', {timeout: 0});
                                        }
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
