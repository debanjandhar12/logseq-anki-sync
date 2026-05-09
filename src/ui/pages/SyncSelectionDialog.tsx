import _ from "lodash";
import {ANKI_ICON} from "../../constants";
import {LogseqContentPreprocessor} from "../../logseq/LogseqContentPreprocessor";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {WindowBridge} from "../../logseq/WindowBridge";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import {DialogModalFooter, Modal, ModalHeader, useModal} from "../";
import {LogseqButton} from "../components/LogseqButton";
import {LogseqCheckbox} from "../components/LogseqCheckbox";
import {LogseqDropdownMenu} from "../components/LogseqDropdownMenu";
import {LogseqPopover} from "../components/LogseqPopover";
import {LogseqTooltip} from "../components/LogseqTooltip";
import React, {useCallback, useEffect, useState} from "../React";
import {UI} from "../UI";

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
    reject: Function;
    modalContext?: {modalId: string | null};
}> = ({toCreateNotes, toUpdateNotes, toDeleteNotes, resolve, reject, modalContext}) => {
    const {open, setOpen, returnResult} = useModal(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false, // We'll handle this manually
        enableEnterKey: false, // We'll handle this manually
        defaultResult: null,
        modalId: modalContext?.modalId
    });
    const [toCreateNotesSelection, setToCreateNotesSelection] = useState(
        new Array(toCreateNotes.length).fill(true)
    );
    const [toUpdateNotesSelection, setToUpdateNotesSelection] = useState(
        new Array(toUpdateNotes.length).fill(true)
    );
    const [toDeleteNotesSelection, setToDeleteNotesSelection] = useState(
        new Array(toDeleteNotes.length).fill(true)
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
            }
        },
        {
            title: "Select None",
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(false));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
            }
        },
        {
            title: "Select New Notes Only",
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(true));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
            }
        }
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
                                            toCreateNotes[index].page.uuid === currentPage.uuid
                                    )
                            );
                            setToUpdateNotesSelection(
                                new Array(toUpdateNotes.length)
                                    .fill(false)
                                    .map(
                                        (_, index) =>
                                            toUpdateNotes[index].page.uuid === currentPage.uuid
                                    )
                            );
                            setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
                        }
                    }
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
        [returnResult, modalContext?.modalId]
    );

    React.useEffect(() => {
        if (open) WindowBridge.addDocumentEventListener("keydown", onKeydown);
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown);
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
            skipOnDependencyHashMatch: true
        });
    }, []);
    React.useEffect(() => {
        logseq.updateSettings({
            skipOnDependencyHashMatch: skipOnHashMatch
        });
    }, [skipOnHashMatch]);

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
                            Create
                            <span
                                className="opacity-50 px-1 flex"
                                style={{userSelect: "none", float: "right", fontSize: "14px"}}>
                                {" "}
                                {toCreateNotesSelection.filter(Boolean).length} /{" "}
                                {toCreateNotesSelection.length}
                                <span style={{width: "15px"}} />
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
                                    const newToCreateNotesSelection = [...toCreateNotesSelection];
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
                                zIndex: 1
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
                                    const newToDeleteNotesSelection = [...toDeleteNotesSelection];
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
                                zIndex: 1
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
                                    const newToUpdateNotesSelection = [...toUpdateNotesSelection];
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
                    cancelText="Cancel">
                    <LogseqPopover
                        placement="top-start"
                        content={
                            <div
                                style={{
                                    boxShadow:
                                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                    borderRadius: "0.25rem",
                                    overflow: "hidden",
                                    margin: 0,
                                    padding: "10px",
                                    backgroundColor: "var(--ls-primary-background-color)",
                                    width: "200px"
                                }}>
                                <LogseqCheckbox
                                    checked={skipOnHashMatch}
                                    onChange={() => setSkipOnHashMatch(!skipOnHashMatch)}>
                                    Skip on hash match (
                                    <LogseqTooltip content="When enabled, this will result in faster performance. However, sometimes this may lead to ignoring some changes.">
                                        ?
                                    </LogseqTooltip>
                                    )
                                </LogseqCheckbox>
                            </div>
                        }>
                        <LogseqButton color={"outline-link"} size={"sm"}>
                            🢁
                        </LogseqButton>
                    </LogseqPopover>
                </DialogModalFooter>
            </div>
        </Modal>
    );
};

// Utils
export const AnkiLink = ({ankiId = null}) => {
    const hoverStyle = {
        backgroundColor: "var(--ls-secondary-border-color)",
        borderRadius: "2px"
    };
    const normalStyle = {backgroundColor: "inherit", borderRadius: "2px"};
    const [style, setStyle] = React.useState(normalStyle);

    const onMouseOver = () => setStyle(hoverStyle);
    const onMouseOut = () => setStyle(normalStyle);
    const onClickHandler = (e: React.MouseEvent) => {
        if (ankiId != null) {
            WindowParentBridge.getAnkiConnect().guiBrowse(`nid:${ankiId}`);
        }

        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
    };

    const children = ankiId == null ? "New note" : ankiId;

    return (
        <LogseqTooltip content={"Anki Note: " + children}>
            <a
                onClick={onClickHandler}
                onMouseOver={onMouseOver}
                onMouseOut={onMouseOut}
                className="inline-flex flex-row items-center button"
                style={{
                    ...style,
                    display: "inline-flex",
                    padding: 0,
                    height: "auto",
                    userSelect: "text",
                    cursor: "pointer"
                }}>
                <i className={"anki-icon"} />
                <span>{children}</span>
            </a>
        </LogseqTooltip>
    );
};

export const LogseqLink = ({uuid, graphName}: {uuid: string; graphName: string}) => {
    const hoverStyle = {
        backgroundColor: "var(--ls-secondary-border-color)",
        borderRadius: "2px"
    };
    const normalStyle = {backgroundColor: "inherit", borderRadius: "2px"};
    const [style, setStyle] = React.useState(normalStyle);
    const [displayText, setDisplayText] = React.useState(uuid);
    const [blockContent, setBlockContent] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchBlockContent = async () => {
            try {
                const block = await LogseqProxy.Editor.getBlock(uuid);
                if (block?.content) {
                    // Preprocess content using LogseqContentPreprocessor
                    const format = block.format || "markdown";
                    const {content: preprocessedContent} =
                        await LogseqContentPreprocessor.preprocess(block.content, format);

                    setBlockContent(preprocessedContent); // for title

                    const cleanedContent = preprocessedContent.replace(/\s+/g, " ").trim();
                    const truncated = _.truncate(cleanedContent, {length: 34, omission: "..."});
                    setDisplayText(truncated); // for display
                } else {
                    // Fallback to UUID if block or content is not available
                    setDisplayText(uuid);
                }
            } catch (_e) {
                // On fetch failure, show UUID
                setDisplayText(uuid);
            }
        };
        fetchBlockContent();
    }, [uuid]);

    const onMouseOver = () => setStyle(hoverStyle);
    const onMouseOut = () => setStyle(normalStyle);
    const onClickHandler = (e: React.MouseEvent) => {
        if (uuid) {
            logseq.Editor.openInRightSidebar(uuid);
            logseq.UI.showMsg(`Block opened in right sidebar.`);
            e.preventDefault();
            e.nativeEvent.stopImmediatePropagation();
        }
    };

    const titleText = blockContent
        ? `Block UUID: ${uuid}\nContent: ${blockContent}`
        : `Block UUID: ${uuid}`;

    return (
        <LogseqTooltip content={titleText}>
            <a
                onMouseOver={onMouseOver}
                onMouseOut={onMouseOut}
                className="inline-flex flex-row items-center button"
                style={{
                    ...style,
                    display: "inline-flex",
                    padding: 0,
                    height: "auto",
                    userSelect: "text",
                    cursor: "pointer"
                }}
                onClick={onClickHandler}>
                <i className={"logseq-icon"} />
                <span>{displayText}</span>
            </a>
        </LogseqTooltip>
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
