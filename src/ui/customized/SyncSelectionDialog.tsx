import React, {useCallback, useEffect, useState} from "react";
import {Modal} from "../general/Modal";
import {LogseqButton} from "../basic/LogseqButton";
import {LogseqCheckbox} from "../basic/LogseqCheckbox";
import ReactDOM from "react-dom";
import {LogseqDropdownMenu} from "../basic/LogseqDropdownMenu";
import {ANKI_ICON} from "../../constants";
import _ from "lodash";

export async function SyncSelectionDialog(
    toCreateNotes: Array<any>,
    toUpdateNotes: Array<any>,
    toDeleteNotes: Array<any>,
): Promise<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
} | null> {
    return new Promise<{
        toCreateNotes: Array<any>;
        toUpdateNotes: Array<any>;
        toDeleteNotes: Array<any>;
    } | null>(async (resolve, reject) => {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            main?.appendChild(div);
            let onClose = () => {
                try {
                    ReactDOM.unmountComponentAtNode(div);
                    div.remove();
                } catch (e) {}
            };
            onClose = onClose.bind(this);
            ReactDOM.render(
                <SyncSelectionDialogComponent
                    toCreateNotes={toCreateNotes}
                    toUpdateNotes={toUpdateNotes}
                    toDeleteNotes={toDeleteNotes}
                    resolve={resolve}
                    reject={reject}
                    onClose={onClose}
                />,
                div,
            );
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e);
            reject(e);
        }
    });
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
    const [open, setOpen] = useState(true);
    const [toCreateNotesSelection, setToCreateNotesSelection] = useState(
        new Array(toCreateNotes.length).fill(true),
    );
    const [toUpdateNotesSelection, setToUpdateNotesSelection] = useState(
        new Array(toUpdateNotes.length).fill(true),
    );
    const [toDeleteNotesSelection, setToDeleteNotesSelection] = useState(
        new Array(toDeleteNotes.length).fill(true),
    );
    // const [isAllCreateNotesSelected, setIsAllCreateNotesSelected] = useState(true);
    // const [isAllUpdateNotesSelected, setIsAllUpdateNotesSelected] = useState(true);
    // const [isAllDeleteNotesSelected, setIsAllDeleteNotesSelected] = useState(true);

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

    const returnResult = React.useCallback(
        (result) => {
            resolve(result);
            setOpen(false);
        },
        [resolve],
    );

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
    }, [resolve]);

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
            returnResult(false);
        }
    }, [open]);

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
            <div className="settings-modal of-plugins">
                <div className="absolute top-0 right-0 pt-2 pr-2">
                    <div style={{display: "flex", alignItems: "center"}}>
                        <LogseqDropdownMenu menuArr={selectionMenu}>
                            <LogseqButton size={"xs"} color="link">
                                Selection
                            </LogseqButton>
                        </LogseqDropdownMenu>
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
                </div>
                <header
                    style={{
                        borderBottom: "1px solid var(--ls-quaternary-background-color)",
                        padding: "8px 12px",
                    }}>
                    <h3 className="title inline-flex items-center" style={{marginTop: "2px"}}>
                        <i className="px-1" dangerouslySetInnerHTML={{__html: ANKI_ICON}}></i>{" "}
                        <strong>Proceed sync with anki?</strong>
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
                            Create
                            <span
                                className="opacity-50 px-1"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toCreateNotesSelection.filter(Boolean).length} /{" "}
                                {toCreateNotesSelection.length}
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
                                className="opacity-50 px-1"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toDeleteNotesSelection.filter(Boolean).length} /{" "}
                                {toDeleteNotesSelection.length}
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
                                className="opacity-50 px-1"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toUpdateNotesSelection.filter(Boolean).length} /{" "}
                                {toUpdateNotesSelection.length}
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
                <div
                    className="mt-5 sm:mt-4 sm:flex"
                    style={{
                        borderTop: "1px solid var(--ls-quaternary-background-color)",
                        padding: "2px",
                        alignItems: "center",
                    }}>
                    <div
                        className="hidden md-block"
                        style={{flexGrow: "1", marginLeft: "12px"}}>
                        <div className={"anki_de"} style={{width: "fit-content"}}>
                            <LogseqButton color={"link"} size={"sm"}>
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
                    </div>
                    <div className="sm:flex sm:flex-row-reverse">
                        <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                            <LogseqButton
                                isFullWidth={true}
                                depth={1}
                                onClick={() => handleConfirm()}
                                color="primary">
                                <span
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                    <span>Confirm</span>
                                    <span
                                        className="opacity-80 ui__button-shortcut-key"
                                        style={{marginLeft: "2px"}}>
                                        ⏎
                                    </span>
                                </span>
                            </LogseqButton>
                        </span>
                        <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                            <LogseqButton
                                isFullWidth={true}
                                depth={1}
                                onClick={() => handleCancel()}>
                                Cancel
                            </LogseqButton>
                        </span>
                    </div>
                </div>
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
    const onClickHandler = (e) => {
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

export const LogseqLink = ({uuid, graphName}) => {
    const hoverStyle = {color: "var(--ctp-link-text-hover-color)"};
    const normalStyle = {color: "inherit"};
    const [style, setStyle] = React.useState(normalStyle);

    const onMouseOver = () => setStyle(hoverStyle);
    const onMouseOut = () => setStyle(normalStyle);

    const href = `logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
        uuid,
    )}`;

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
            href={href}>
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
