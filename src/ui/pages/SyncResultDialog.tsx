import _ from "lodash";
import {ANKI_ICON} from "../../constants";
import {createLogger, LoggerCategory} from "../../logger";
import type {SyncResult} from "../../sync/types";
import {Modal, ModalHeader, useModal} from "../";
import React, {useState} from "../React";
import {UI} from "../UI";
import {CreateLineDisplay, UpdateLineDisplay} from "./SyncSelectionDialog";

const logger = createLogger(LoggerCategory.UI);

export const SyncResultDialogComponent: React.FC<{
    syncResult: SyncResult;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}> = ({syncResult, resolve, reject, modalContext}) => {
    const {
        toCreateNotes: createdNotes,
        toUpdateNotes: updatedNotes,
        toDeleteNotes: deletedNotes,
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
                                zIndex: 1
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
                                            userSelect: "none"
                                        }}
                                        title={"Synced Successfully"}>
                                        ✓
                                    </span>
                                    <UpdateLineDisplay note={note} graphName={graphName} />{" "}
                                    {/* Use update line display for created notes */}
                                </span>
                            )
                        )}
                        {Object.keys(failedCreated).map((noteUuidTypeStr) => {
                            const uuid = noteUuidTypeStr.substring(
                                0,
                                noteUuidTypeStr.lastIndexOf("-")
                            );
                            const type = noteUuidTypeStr.substring(
                                noteUuidTypeStr.lastIndexOf("-") + 1
                            );
                            return (
                                <span className="inline-flex items-center" key={uuid + type}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--amplify-colors-font-error)",
                                            userSelect: "none"
                                        }}
                                        title={"Sync Failed"}>
                                        ⚠
                                    </span>
                                    <CreateLineDisplay note={{uuid, type}} graphName={graphName} />
                                    <a
                                        style={{fontSize: "14px", marginLeft: "5px"}}
                                        onClick={() => {
                                            const error = failedCreated[noteUuidTypeStr];
                                            logger.info(
                                                `Error object for ${noteUuidTypeStr}:`,
                                                error
                                            );
                                            const errorMessage = `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`;
                                            logseq.UI.showMsg(errorMessage, "warning", {
                                                timeout: 0
                                            });
                                        }}>
                                        (show error details)
                                    </a>
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
                                zIndex: 1
                            }}>
                            Deleted
                        </div>
                        <span style={{fontSize: "14px"}}>
                            {deletedNotes.length > 0
                                ? `The ${deletedNotes.length} notes were deleted successfully`
                                : `No notes were deleted.`}
                            {Object.keys(failedDeleted).length > 0 ? (
                                <span>
                                    The ${Object.keys(failedDeleted).length} notes failed to delete
                                    <a
                                        style={{fontSize: "14px", marginLeft: "5px"}}
                                        onClick={() => {
                                            logger.info(
                                                `Error object for all failed deletes:`,
                                                failedDeleted
                                            );
                                            const errorMessage = `${JSON.stringify(failedDeleted)}`;
                                            logseq.UI.showMsg(errorMessage, "warning", {
                                                timeout: 0
                                            });
                                        }}>
                                        (show error details)
                                    </a>
                                </span>
                            ) : (
                                ``
                            )}
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
                                zIndex: 1
                            }}>
                            Updated
                        </div>
                        {updatedNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes were updated.</span>
                        )}
                        {updatedNotes.map((note) =>
                            failedUpdated[note.uuid + "-" + note.type] ? null : (
                                <span
                                    className="inline-flex items-center"
                                    key={note.uuid + note.type}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--amplify-colors-font-success)",
                                            userSelect: "none"
                                        }}
                                        title={"Synced Successfully"}>
                                        ✓
                                    </span>
                                    <UpdateLineDisplay note={note} graphName={graphName} />
                                </span>
                            )
                        )}
                        {Object.keys(failedUpdated).map((noteUuidTypeStr) => {
                            const uuid = noteUuidTypeStr.substring(
                                0,
                                noteUuidTypeStr.lastIndexOf("-")
                            );
                            const type = noteUuidTypeStr.substring(
                                noteUuidTypeStr.lastIndexOf("-") + 1
                            );
                            return (
                                <span className="inline-flex items-center" key={uuid + type}>
                                    <span
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--amplify-colors-font-error)",
                                            userSelect: "none"
                                        }}
                                        title={"Sync Failed"}>
                                        ⚠
                                    </span>
                                    <UpdateLineDisplay note={{uuid, type}} graphName={graphName} />
                                    <a
                                        style={{fontSize: "14px", marginLeft: "5px"}}
                                        onClick={() => {
                                            const error = failedUpdated[noteUuidTypeStr];
                                            logger.info(
                                                `Error object for ${noteUuidTypeStr}:`,
                                                error
                                            );
                                            const errorMessage = `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`;
                                            logseq.UI.showMsg(errorMessage, "warning", {
                                                timeout: 0
                                            });
                                        }}>
                                        (show error details)
                                    </a>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
