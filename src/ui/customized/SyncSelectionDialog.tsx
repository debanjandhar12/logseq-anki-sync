import React, { useEffect, useState } from "react";
import {Modal} from "../general/Modal";
import {LogseqButton} from "../basic/LogseqButton";
import {LogseqCheckbox} from "../basic/LogseqCheckbox";
import ReactDOM from "react-dom";
import {LogseqDropdownMenu} from "../basic/LogseqDropdownMenu";
import {ANKI_ICON, LOGSEQ_ICON} from "../../constants";
import _ from "lodash";

export async function SyncSelectionDialog(toCreateNotes: Array<any>, toUpdateNotes: Array<any>, toDeleteNotes: Array<any>): Promise<{ toCreateNotes: Array<any>; toUpdateNotes: Array<any>; toDeleteNotes: Array<any> } | null> {
    return new Promise<{ toCreateNotes: Array<any>; toUpdateNotes: Array<any>; toDeleteNotes: Array<any> } | null>(async (resolve, reject) => {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            main?.appendChild(div);
            let onClose = () => {
                try {
                 ReactDOM.unmountComponentAtNode(div);
                 div.remove();
                } catch (e) {}
            }
            onClose = onClose.bind(this);
            ReactDOM.render(<SyncSelectionDialogComponent toCreateNotes={toCreateNotes} toUpdateNotes={toUpdateNotes} toDeleteNotes={toDeleteNotes} resolve={resolve} reject={reject} onClose={onClose}/>, div);
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e)
            reject(e);
        }
    });
}
const SyncSelectionDialogComponent : React.FC<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
    resolve: (value: { toCreateNotes: Array<any>; toUpdateNotes: Array<any>; toDeleteNotes: Array<any> } | null) => void;
    reject: Function;
    onClose: () => void;
}> = ({ toCreateNotes, toUpdateNotes, toDeleteNotes, resolve, reject, onClose }) => {
    const [open, setOpen] = useState(true);
    const [toCreateNotesSelection, setToCreateNotesSelection] = useState(new Array(toCreateNotes.length).fill(true));
    const [toUpdateNotesSelection, setToUpdateNotesSelection] = useState(new Array(toUpdateNotes.length).fill(true));
    const [toDeleteNotesSelection, setToDeleteNotesSelection] = useState(new Array(toDeleteNotes.length).fill(true));
    const [isAllCreateNotesSelected, setIsAllCreateNotesSelected] = useState(true);
    const [isAllUpdateNotesSelected, setIsAllUpdateNotesSelected] = useState(true);
    const [isAllDeleteNotesSelected, setIsAllDeleteNotesSelected] = useState(true);
    const [selectionMenu, setSelectionMenu] = useState([
        {
            title: 'Select All',
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(true));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(true));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(true));
            }
        },
        {
            title: 'Select None',
            onClick: () => {
                setToCreateNotesSelection(new Array(toCreateNotes.length).fill(false));
                setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false));
                setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
            }
        },
        {
            title: 'Select New Notes Only',
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
                setSelectionMenu(prevSelectionMenu => [
                    ...prevSelectionMenu,
                    {
                        title: 'Select Current Page Notes',
                        onClick: ()=> {
                            setToCreateNotesSelection(new Array(toCreateNotes.length).fill(false).map((_, index) => toCreateNotes[index].page.uuid === currentPage.uuid));
                            setToUpdateNotesSelection(new Array(toUpdateNotes.length).fill(false).map((_, index) => toUpdateNotes[index].page.uuid === currentPage.uuid));
                            setToDeleteNotesSelection(new Array(toDeleteNotes.length).fill(false));
                        }
                    }
                ]);
            }
        }
        addAdditionalSelectionMenu().then();
    }, []);

    useEffect(() => {
        setIsAllCreateNotesSelected(toCreateNotesSelection.every(Boolean));
        setIsAllUpdateNotesSelected(toUpdateNotesSelection.every(Boolean));
        setIsAllDeleteNotesSelected(toDeleteNotesSelection.every(Boolean));
    }, [toCreateNotesSelection, toUpdateNotesSelection, toDeleteNotesSelection]);

    const returnResult = React.useCallback((result) => {
        resolve(result);
        setOpen(false);
    }, [resolve]);

    const handleConfirm = () => {
        returnResult({
            toCreateNotes: toCreateNotesSelection.map((selected, index) => selected ? toCreateNotes[index] : null).filter(Boolean),
            toUpdateNotes: toUpdateNotesSelection.map((selected, index) => selected ? toUpdateNotes[index] : null).filter(Boolean),
            toDeleteNotes: toDeleteNotesSelection.map((selected, index) => selected ? toDeleteNotes[index] : null).filter(Boolean),
        });
    };

    const handleCancel = () => {
        returnResult(null);
    };

    const onKeydown = React.useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            handleCancel();
        }
        else if (e.key === "Enter") {
            handleConfirm();
        }
    }, [returnResult]);

    React.useEffect(() => {
        if (open)
            window.parent.document.addEventListener("keydown", onKeydown);
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown);
        }
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
        }
        getGraphName().then();
    }, []);

    return (
        <Modal open={open} setOpen={setOpen} onClose={onClose} hasCloseButton={false}>
            <div className="settings-modal of-plugins">
                <div className="absolute top-0 right-0 pt-2 pr-2">
                    <div style={{display: "flex", alignItems: "center"}}>
                        <LogseqDropdownMenu menuArr={selectionMenu}>
                            <LogseqButton
                                size={"xs"}
                                color='link'>Selection</LogseqButton>
                        </LogseqDropdownMenu>
                        <button aria-label="Close" type="button"
                                className="ui__modal-close opacity-60 hover:opacity-100"
                                onClick={() => setOpen(false)}>
                            <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                                <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinejoin="round"
                                      strokeLinecap="round"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <header style={{borderBottom: '1px solid var(--ls-quaternary-background-color)', padding: '8px 12px'}}>
                    <h3 className="title inline-flex items-center" style={{marginTop: '2px'}}><i className="px-1" dangerouslySetInnerHTML={{__html: ANKI_ICON}}></i> <strong>Proceed sync with anki?</strong></h3>
                </header>
                <div className="sm:flex sm:items-start"
                     style={{maxHeight: '70vh', overflowY: "auto", overflowX: "hidden"}}>
                    <div className="mt-3 sm:mt-0 ml-4 mr-4 flex" style={{width: '100%', flexDirection: 'column'}}>
                        <div className="p-4" style={{
                            backgroundColor: 'var(--ls-tertiary-background-color)',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            marginTop: '0.5rem',
                            marginBottom: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            userSelect: 'none',
                            zIndex: 1
                        }}>Create
                        </div>
                        {toCreateNotes.length <= 0 && (<span style={{fontSize: '14px'}}>No notes to be created</span>)}
                        {toCreateNotes.map((note, index) => (
                            <LogseqCheckbox
                                checked={toCreateNotesSelection[index]}
                                onChange={() => {
                                    let newToCreateNotesSelection = [...toCreateNotesSelection];
                                    newToCreateNotesSelection[index] = !newToCreateNotesSelection[index];
                                    setToCreateNotesSelection(newToCreateNotesSelection);
                                }}
                            >
                                <span dangerouslySetInnerHTML={{__html: buildCreateLineDisplay(note, graphName)}}></span>
                            </LogseqCheckbox>
                        ))}
                        <div className="p-4" style={{
                            backgroundColor: 'var(--ls-tertiary-background-color)',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            marginTop: '0.5rem',
                            marginBottom: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            userSelect: 'none',
                            zIndex: 1
                        }}>Update
                        </div>
                        {toUpdateNotes.length <= 0 && (<span style={{fontSize: '14px'}}>No notes to be updated</span>)}
                        {toUpdateNotes.map((note, index) => (
                            <LogseqCheckbox
                            checked={toUpdateNotesSelection[index]}
                         onChange={() => {
                             let newToUpdateNotesSelection = [...toUpdateNotesSelection];
                             newToUpdateNotesSelection[index] = !newToUpdateNotesSelection[index];
                             setToUpdateNotesSelection(newToUpdateNotesSelection);
                         }}
                    >
                        <span dangerouslySetInnerHTML={{__html: buildUpdateLineDisplay(note, graphName)}}></span>
                    </LogseqCheckbox>
                    ))}
                    <div className="p-4" style={{
                        backgroundColor: 'var(--ls-tertiary-background-color)',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        marginTop: '0.5rem',
                        marginBottom: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        userSelect: 'none',
                        zIndex: 1
                    }}>Delete
                    </div>
                    {toDeleteNotes.length <= 0 && ( <span style={{fontSize: '14px'}}>No notes to be deleted</span> )}
                    {toDeleteNotes.map((note, index) => (
                    <LogseqCheckbox
                        checked={toDeleteNotesSelection[index]}
                        onChange={() => {
                            let newToDeleteNotesSelection = [...toDeleteNotesSelection];
                            newToDeleteNotesSelection[index] = !newToDeleteNotesSelection[index];
                            setToDeleteNotesSelection(newToDeleteNotesSelection);
                        }}
                    >
                        <span dangerouslySetInnerHTML={{__html: buildDeleteLineDisplay(note.ankiId)}}></span>
                    </LogseqCheckbox>
                    ))
                    }
                </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse" style={{borderTop: '1px solid var(--ls-quaternary-background-color)', padding: '2px'}}>
                    <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                        <LogseqButton
                            isFullWidth={true}
                            isCentered={true}
                            onClick={() => handleConfirm()}
                            color='primary'><span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}><span>Confirm</span><span
                            className="px-1 opacity-80"><code>⏎</code></span></span></LogseqButton>
                    </span>
                    <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                        <LogseqButton
                            isFullWidth={true}
                            isCentered={true}
                            color={'faded-default'}
                            onClick={() => handleCancel()}>Cancel</LogseqButton>
                    </span>
                </div>
            </div>
        </Modal>
    );
}

// Utils
export const buildAnkiLink = (ankiId) => {
    if (ankiId == null) return `<a class="inline-flex flex-row items-center button" style="color:inherit; display: inline-flex; padding: 0; height: auto; user-select: text;" onMouseOver="this.style.color='var(--ctp-link-text-hover-color)'" onMouseOut="this.style.color='inherit'"><i>${ANKI_ICON}</i><span>New note</span></a>`
    return `<a class="inline-flex flex-row items-center button" style="color:inherit; display: inline-flex; padding: 0; height: auto; user-select: text;" onMouseOver="this.style.color='var(--ctp-link-text-hover-color)'" onMouseOut="this.style.color='inherit'"  onclick="window.AnkiConnect.guiBrowse('nid:${ankiId}')"><i>${ANKI_ICON}</i><span>${ankiId}</span></a>`
}
export const buildLogseqLink = (uuid, graphName) => {
    return `<a class="inline-flex flex-row items-center button" style="color:inherit; display: inline-flex; padding: 0; height:auto; user-select: text;" onMouseOver="this.style.color='var(--ctp-link-text-hover-color)'" onMouseOut="this.style.color='inherit'" href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(uuid)}"><i>${LOGSEQ_ICON}</i><span>${uuid}</span></a>`
}

export const buildCreateLineDisplay = (note, graphName) => {
    return `<span class="inline-flex items-center"><span class="opacity-50 px-1" style="user-select: none">[${note.type}]</span>
                                                ${buildLogseqLink(note.uuid, graphName)} <span class="px-1" style="user-select: none">--></span> ${buildAnkiLink(null)}</span>`;
}

export const buildUpdateLineDisplay = (note, graphName) => {
    if (note.ankiId == null)
        return `<span class="inline-flex items-center"><span class="opacity-50 px-1" style="user-select: none">[${note.type}]</span>
                                                ${buildLogseqLink(note.uuid, graphName)}</span>`;
    return `<span class="inline-flex items-center"><span class="opacity-50 px-1" style="user-select: none">[${note.type}]</span>
                                                ${buildLogseqLink(note.uuid, graphName)} <span class="px-1" style="user-select: none">--></span> ${buildAnkiLink(note.ankiId)}</span>`;
}

export const buildDeleteLineDisplay = (ankiId) => {
    return `<span class="inline-flex items-center">${buildAnkiLink(ankiId)}</span>`;
}