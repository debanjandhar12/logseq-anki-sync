import React, {useCallback, useEffect, useState} from "../React";
import {Modal} from "../modals/Modal";
import {LogseqButton} from "../common/LogseqButton";
import {LogseqCheckbox} from "../common/LogseqCheckbox";
import {LogseqDropdownMenu} from "../common/LogseqDropdownMenu";
import {ANKI_ICON} from "../../constants";
import _ from "lodash";
import { createModalPromise } from "../modals/utils/createModalPromise";
import { ModalHeader } from "../modals/ModalHeader";
import { DialogModalFooter } from "../modals/ModalFooter";
import { useModal } from "../modals/hooks/useModal";

export async function SyncSelectionDialog(
    toCreateNotes: Array<any>,
    toUpdateNotes: Array<any>,
    toDeleteNotes: Array<any>,
): Promise<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
} | null> {
    return createModalPromise<{
        toCreateNotes: Array<any>;
        toUpdateNotes: Array<any>;
        toDeleteNotes: Array<any>;
    } | null>(
        (props) => (
            <SyncSelectionDialogComponent
                toCreateNotes={toCreateNotes}
                toUpdateNotes={toUpdateNotes}
                toDeleteNotes={toDeleteNotes}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open sync selection dialog" }
    );
}
const SyncSelectionDialogComponent: React.FC<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
    resolve: (
        value: {
            toCreateNotes: Array<any>;
            toUpdateNotes: Array<any>;
            toDeleteNotes: Array<any>;
        } | null,
    ) => void;
    reject: Function;
    onClose: () => void;
}> = ({toCreateNotes, toUpdateNotes, toDeleteNotes, resolve, reject, onClose}) => {
    const { open, setOpen, returnResult } = useModal(resolve, {
        onClose,
        enableEscapeKey: false, // We'll handle this manually
        enableEnterKey: false,  // We'll handle this manually
        defaultResult: null,
    });
    const [toCreateNotesSelection, setToCreateNotesSelection] = useState(
        new Array(toCreateNotes.length).fill(true),
    );
    const [toUpdateNotesSelection, setToUpdateNotesSelection] = useState(
        new Array(toUpdateNotes.length).fill(true),
    );
    const [toDeleteNotesSelection, setToDeleteNotesSelection] = useState(
        new Array(toDeleteNotes.length).fill(true),
    );
    const [toCreateNotesCheckbox, setToCreateNotesCheckbox] = useState<
        "checked" | "unchecked" | "indeterminate"
    >("checked");
    const [toUpdateNotesCheckbox, setToUpdateNotesCheckbox] = useState<
        "checked" | "unchecked" | "indeterminate"
    >("checked");
    const [toDeleteNotesCheckbox, setToDeleteNotesCheckbox] = useState<
        "checked" | "unchecked" | "indeterminate"
    >("checked");

    useEffect(() => {
        const isAllCreateNotesSelected = toCreateNotesSelection.every(Boolean);
        const isNoneCreateNotesSelected = !toCreateNotesSelection.some(Boolean);
        setToCreateNotesCheckbox(
            isAllCreateNotesSelected
                ? "checked"
                : isNoneCreateNotesSelected
                    ? "unchecked"
                    : "indeterminate"
        );
    }, [toCreateNotesSelection]);

    useEffect(() => {
        const isAllUpdateNotesSelected = toUpdateNotesSelection.every(Boolean);
        const isNoneUpdateNotesSelected = !toUpdateNotesSelection.some(Boolean);
        setToUpdateNotesCheckbox(
            isAllUpdateNotesSelected
                ? "checked"
                : isNoneUpdateNotesSelected
                    ? "unchecked"
                    : "indeterminate"
        );
    }, [toUpdateNotesSelection]);

    useEffect(() => {
        const isAllDeleteNotesSelected = toDeleteNotesSelection.every(Boolean);
        const isNoneDeleteNotesSelected = !toDeleteNotesSelection.some(Boolean);
        setToDeleteNotesCheckbox(
            isAllDeleteNotesSelected
                ? "checked"
                : isNoneDeleteNotesSelected
                    ? "unchecked"
                    : "indeterminate"
        );
    }, [toDeleteNotesSelection]);

    const handleCreateNotesCheckboxClick = () => {
        const newSelection =
            toCreateNotesCheckbox === "checked"
                ? new Array(toCreateNotes.length).fill(false)
                : new Array(toCreateNotes.length).fill(true);
        setToCreateNotesSelection(newSelection);
    };

    const handleUpdateNotesCheckboxClick = () => {
        const newSelection =
            toUpdateNotesCheckbox === "checked"
                ? new Array(toUpdateNotes.length).fill(false)
                : new Array(toUpdateNotes.length).fill(true);
        setToUpdateNotesSelection(newSelection);
    };

    const handleDeleteNotesCheckboxClick = () => {
        const newSelection =
            toDeleteNotesCheckbox === "checked"
                ? new Array(toDeleteNotes.length).fill(false)
                : new Array(toDeleteNotes.length).fill(true);
        setToDeleteNotesSelection(newSelection);
    };

    const [selectionMenu, setSelectionMenu] = useState([
        {
            title: "Select All",
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(true));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(true));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(true));
            },
        },
        {
            title: "Select None",
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(false));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
            },
        },
        {
            title: "Select New Notes Only",
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(true));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
            },
        },
    ]);
    useEffect(() => {
        const addAdditionalSelectionMenu = async () => {
            const currentPage = await logseq.Editor.getCurrentPage();
            if (currentPage != null) {
                setSelectionMenu((prevSelectionMenu) => [
                    ...prevSelectionMenu,
                    {
                        title: "Select Current Page Notes",
                        onClick: () => {
                            setToCreateNotesSelection(
                                new Array(toCreateNotes.length)
                                    .fill(false)
                                    .map(
                                        (_, index) =>
                                            toCreateNotes[index].page.uuid === currentPage.uuid,
                                    ),
                            );
                            setToUpdateNotesSelection(
                                new Array(toUpdateNotes.length)
                                    .fill(false)
                                    .map(
                                        (_, index) =>
                                            toUpdateNotes[index].page.uuid === currentPage.uuid,
                                    ),
                            );
                            setToDeleteNotesSelection(
                                new Array(toDeleteNotes.length).fill(false),
                            );
                        },
                    },
                ]);
            }
        };
        addAdditionalSelectionMenu().then();
    }, []);

    // useEffect(() => {
    //     setIsAllCreateNotesSelected(toCreateNotesSelection.every(Boolean));
    //     setIsAllUpdateNotesSelected(toUpdateNotesSelection.every(Boolean));
    //     setIsAllDeleteNotesSelected(toDeleteNotesSelection.every(Boolean));
    // }, [toCreateNotesSelection, toUpdateNotesSelection, toDeleteNotesSelection]);

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
                .filter(Boolean),
        });
    }, [
        returnResult,
        toCreateNotes,
        toUpdateNotes,
        toDeleteNotes,
        toCreateNotesSelection,
        toUpdateNotesSelection,
        toDeleteNotesSelection,
    ]);

    const handleCancel = useCallback(() => {
        returnResult(null);
    }, [returnResult]);

    const onKeydown = React.useCallback(
        (e: KeyboardEvent) => {
            if (!open) return;
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
        [returnResult],
    );

    React.useEffect(() => {
        if (open) window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        };
    }, [open]);

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

    const [skipOnHashMatch, setSkipOnHashMatch] = useState(true);
    React.useEffect(() => {
        logseq.updateSettings({
            skipOnDependencyHashMatch: true,
        });
    }, []);
    React.useEffect(() => {
        logseq.updateSettings({
            skipOnDependencyHashMatch: skipOnHashMatch,
        });
    }, [skipOnHashMatch]);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} hasCloseButton={false}>
            <div className="of-plugins pb-2" style={{margin: '-2rem'}}>
                <ModalHeader
                    title="Proceed sync with anki?"
                    icon={ANKI_ICON}
                    onClose={() => setOpen(false)}
                    showCloseButton={true}
                >
                    <LogseqDropdownMenu menuArr={selectionMenu}>
                        <LogseqButton size={"xs"} color="outline-link">
                            Selection
                        </LogseqButton>
                    </LogseqDropdownMenu>
                </ModalHeader>
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
                            Create
                            <span
                                className="opacity-50 px-1 flex"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toCreateNotesSelection.filter(Boolean).length} /{" "}
                                {toCreateNotesSelection.length}
                                <span style={{width: '15px'}} />
                                <LogseqCheckbox
                                    checked={toCreateNotesCheckbox === "checked"}
                                    indeterminate={toCreateNotesCheckbox === "indeterminate"}
                                    onChange={handleCreateNotesCheckboxClick}
                                />
                            </span>
                        </div>
                        {toCreateNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes to be created.</span>
                        )}
                        {toCreateNotes.map((note, index) => (
                            <LogseqCheckbox
                                checked={toCreateNotesSelection[index]}
                                key={note.uuid + note.type}
                                onChange={() => {
                                    let newToCreateNotesSelection = [...toCreateNotesSelection];
                                    newToCreateNotesSelection[index] =
                                        !newToCreateNotesSelection[index];
                                    setToCreateNotesSelection(newToCreateNotesSelection);
                                }}>
                                <CreateLineDisplay note={note} graphName={graphName} />
                            </LogseqCheckbox>
                        ))}
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
                            Delete
                            <span
                                className="opacity-50 px-1 flex"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toDeleteNotesSelection.filter(Boolean).length} /{" "}
                                {toDeleteNotesSelection.length}
                                <span style={{width: "15px"}} />
                                <LogseqCheckbox
                                    checked={toDeleteNotesCheckbox === "checked"}
                                    indeterminate={toDeleteNotesCheckbox === "indeterminate"}
                                    onChange={handleDeleteNotesCheckboxClick}
                                />
                            </span>
                        </div>
                        {toDeleteNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes to be deleted.</span>
                        )}
                        {toDeleteNotes.map((ankiId, index) => (
                            <LogseqCheckbox
                                key={ankiId}
                                checked={toDeleteNotesSelection[index]}
                                onChange={() => {
                                    let newToDeleteNotesSelection = [...toDeleteNotesSelection];
                                    newToDeleteNotesSelection[index] =
                                        !newToDeleteNotesSelection[index];
                                    setToDeleteNotesSelection(newToDeleteNotesSelection);
                                }}>
                                <DeleteLineDisplay ankiId={ankiId} />
                            </LogseqCheckbox>
                        ))}
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
                            Update
                            <span
                                className="opacity-50 px-1 flex"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toUpdateNotesSelection.filter(Boolean).length} /{" "}
                                {toUpdateNotesSelection.length}
                                <span style={{width: "15px"}} />
                                <LogseqCheckbox
                                    checked={toUpdateNotesCheckbox === "checked"}
                                    indeterminate={toUpdateNotesCheckbox === "indeterminate"}
                                    onChange={handleUpdateNotesCheckboxClick}
                                />
                            </span>
                        </div>
                        {toUpdateNotes.length <= 0 && (
                            <span style={{fontSize: "14px"}}>No notes to be updated.</span>
                        )}
                        {toUpdateNotes.map((note, index) => (
                            <LogseqCheckbox
                                checked={toUpdateNotesSelection[index]}
                                key={note.uuid + note.type}
                                onChange={() => {
                                    let newToUpdateNotesSelection = [...toUpdateNotesSelection];
                                    newToUpdateNotesSelection[index] =
                                        !newToUpdateNotesSelection[index];
                                    setToUpdateNotesSelection(newToUpdateNotesSelection);
                                }}>
                                <UpdateLineDisplay note={note} graphName={graphName} />
                            </LogseqCheckbox>
                        ))}
                    </div>
                </div>
                <DialogModalFooter
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmText="Confirm"
                    cancelText="Cancel"
                >
                    <div className={"anki_de"} style={{width: "fit-content"}}>
                        <LogseqButton color={"outline-link"} size={"sm"}>
                            🢁
                        </LogseqButton>
                        <div className={"footer-option-list"}>
                            <LogseqCheckbox
                                checked={skipOnHashMatch}
                                onChange={() => setSkipOnHashMatch(!skipOnHashMatch)}>
                                Skip on hash match (
                                <abbr title="When enabled, this will result in faster performance. However, sometimes this may lead to ignoring some changes.">
                                    ?
                                </abbr>
                                )
                            </LogseqCheckbox>
                        </div>
                    </div>
                </DialogModalFooter>
            </div>
        </Modal>
    );
};

// Utils
export const AnkiLink = ({ankiId = null}) => {
    const hoverStyle = {color: "var(--ctp-link-text-hover-color)"};
    const normalStyle = {color: "inherit"};
    const [style, setStyle] = React.useState(normalStyle);

    const onMouseOver = () => setStyle(hoverStyle);
    const onMouseOut = () => setStyle(normalStyle);
    const onClickHandler = (e: React.MouseEvent) => {
        if (ankiId != null) {
            window.parent.AnkiConnect.guiBrowse(`nid:${ankiId}`);
        }

        e.preventDefault();
        e.stopImmediatePropagation();
    };

    const children = ankiId == null ? "New note" : ankiId;

    return (
        <a
            onClick={onClickHandler}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            className="inline-flex flex-row items-center button"
            title={"Anki Note: " + children}
            style={{
                ...style,
                display: "inline-flex",
                padding: 0,
                height: "auto",
                userSelect: "text",
            }}>
            <i className={"anki-icon"} />
            <span>{children}</span>
        </a>
    );
};

export const LogseqLink = ({uuid, graphName}: {uuid: string; graphName: string}) => {
    const hoverStyle = {color: "var(--ctp-link-text-hover-color)"};
    const normalStyle = {color: "inherit"};
    const [style, setStyle] = React.useState(normalStyle);

    const onMouseOver = () => setStyle(hoverStyle);
    const onMouseOut = () => setStyle(normalStyle);
    const onClickHandler = (e: React.MouseEvent) => {
        if (uuid) {
            logseq.Editor.openInRightSidebar(uuid);
            logseq.UI.showMsg(`Block opened in right sidebar.`);
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    };

    return (
        <a
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            className="inline-flex flex-row items-center button"
            title={"Logseq Block: " + uuid}
            style={{
                ...style,
                display: "inline-flex",
                padding: 0,
                height: "auto",
                userSelect: "text",
            }}
            onClick={onClickHandler}>
            <i className={"logseq-icon"} />
            <span>{uuid}</span>
        </a>
    );
};

export const CreateLineDisplay = ({note, graphName}) => {
    return (
        <span className="inline-flex items-center" style={{fontSize: "14px"}}>
            <span className="opacity-50 px-1" style={{userSelect: "none", flexShrink: "0"}}>
                [{note.type}]
            </span>
            <span className={`truncate`}>
                <LogseqLink uuid={note.uuid} graphName={graphName} />
            </span>
            <span className="px-1" style={{userSelect: "none"}}>{`⟶`}</span>
            <span style={{flexShrink: "0"}}>
                <AnkiLink />
            </span>
        </span>
    );
};

export const UpdateLineDisplay = ({note, graphName}) => {
    return (
        <span className="inline-flex items-center" style={{fontSize: "14px"}}>
            <span className="opacity-50 px-1" style={{userSelect: "none", flexShrink: "0"}}>
                [{note.type}]
            </span>
            <span className={`truncate`}>
                <LogseqLink uuid={note.uuid} graphName={graphName} />
            </span>
            {note.ankiId && (
                <>
                    <span className="px-1" style={{userSelect: "none"}}>{`⟶`}</span>
                    <span style={{flexShrink: "0"}}>
                        <AnkiLink ankiId={note.ankiId} />
                    </span>
                </>
            )}
        </span>
    );
};

export const DeleteLineDisplay = ({ankiId}) => {
    return (
        <span className="inline-flex items-center" style={{fontSize: "14px"}}>
            <AnkiLink ankiId={ankiId} />
        </span>
    );
};
