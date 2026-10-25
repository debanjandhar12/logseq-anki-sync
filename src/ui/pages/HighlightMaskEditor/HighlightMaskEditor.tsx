import React from "react";
import {ANKI_ICON, DONATE_ICON} from "../../../constants";
import {
    describeTextQuote,
    getHealedHighlightGeometry,
    matchTextQuote
} from "../../../utils/HighlightNoteQuotePosFinder";
import useUndo from "../../hooks/useUndo";
import {showConfirmModal} from "../../launchers/showConfirmModal";
import type {
    HighlightMaskData,
    HighlightMaskElement
} from "../../launchers/showHighlightMaskEditor";
import {showInputModal} from "../../launchers/showInputModal";
import {Modal} from "../../modals/core/Modal";
import {DialogModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {HighlightMaskToolbar} from "./HighlightMaskToolbar";
import type {HighlightMaskEditorProps} from "./types";
import {useHighlightDecorations} from "./useHighlightDecorations";
import {useHighlightMaskEditor} from "./useHighlightMaskEditor";
import {useHighlightMaskKeyboard} from "./useHighlightMaskKeyboard";
import {editorRangeToTextRange} from "./utils/editorRangeToTextRange";

export const HighlightMaskEditorComponent: React.FC<HighlightMaskEditorProps> = ({
    rawText,
    highlightElements,
    highlightConfig,
    blockTags,
    resolve,
    modalContext
}) => {
    const {open, setOpen, returnResult} = useModal<HighlightMaskData | boolean>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false,
        enableEnterKey: false,
        enableOutsideClickClose: false,
        modalId: modalContext?.modalId
    });

    const [tags, setTags] = React.useState<string[]>(blockTags);

    // Store initial elements in a ref to ensure stable hook initialization
    const initialElementsRef = React.useRef(highlightElements);

    const [
        elementsState,
        {set: setElements, undo: undoElements, redo: redoElements, canUndo, canRedo}
    ] = useUndo(initialElementsRef.current);
    const elements = elementsState.present;

    const [selectedElementIndex, setSelectedElementIndex] = React.useState<number | null>(null);
    const [clozeId, setClozeId] = React.useState<string>("1");
    const {editor, editorRef, hasTextSelection} = useHighlightMaskEditor(
        rawText,
        open,
        setSelectedElementIndex
    );

    const handleConfirm = async () => {
        if (!editor) return;
        const fullText = editor.state.doc.textContent;
        const newElements = [];

        for (const el of elements) {
            const healResult = await getHealedHighlightGeometry(fullText, el);
            if (healResult) {
                newElements.push(healResult.element);
            } else {
                newElements.push(el);
            }
        }

        returnResult({
            config: highlightConfig,
            elements: newElements,
            tags: tags
        });
    };

    const handleCancel = async () => {
        if (canUndo) {
            const confirmed = await showConfirmModal(
                "You have unsaved changes. Are you sure you want to close the Highlight Mask Editor?",
                {confirmText: "Discard", cancelText: "Cancel"}
            );
            if (!confirmed) return;
        }
        returnResult(false);
    };

    useHighlightDecorations(editor, elements, selectedElementIndex);

    // Add Highlight
    const addHighlight = async () => {
        if (!editor) return;
        const {from, to} = editor.state.selection;
        if (from === to) {
            logseq.UI.showMsg("Please select text to highlight", "warning");
            return;
        }

        const text = editor.state.doc.textBetween(from, to, " ");
        if (!text || text.trim() === "") {
            logseq.UI.showMsg("Please select valid text to highlight", "warning");
            return;
        }

        const fullText = editor.state.doc.textContent;
        const {start: actualStart, end: actualEnd} = editorRangeToTextRange(
            editor.state.doc,
            from,
            to
        );

        const quoteInfo = await describeTextQuote(fullText, actualStart, actualEnd);

        // Overlap Check (using naive intersections on text lengths)
        let hasOverlap = false;
        let overlapIndex = -1;
        for (let idx = 0; idx < elements.length; idx++) {
            const el = elements[idx];

            const matchResult = await matchTextQuote(fullText, {
                exact: el.text,
                prefix: el.prefix,
                suffix: el.suffix
            });

            if (matchResult) {
                const elStart = matchResult.start;
                const elEnd = matchResult.end;
                if (actualStart < elEnd && actualEnd > elStart) {
                    hasOverlap = true;
                    overlapIndex = idx;
                    break;
                }
            }
        }

        if (hasOverlap) {
            setSelectedElementIndex(overlapIndex);
            editor.commands.setTextSelection(0);
            logseq.UI.showMsg("Selection overlaps with existing highlight", "warning");
            return;
        }

        const usedCIds = elements.map((el) => el.cId);
        let newCId = 1;
        while (usedCIds.includes(newCId) && newCId < 10) newCId++;
        if (newCId > 9) newCId = 1;

        const newElement: HighlightMaskElement = {
            cId: newCId,
            text: text,
            prefix: quoteInfo.prefix || "",
            suffix: quoteInfo.suffix || ""
        };

        setElements([...elements, newElement]);
        setSelectedElementIndex(elements.length);
        editor.commands.setTextSelection(0);
    };

    const deleteHighlight = () => {
        if (selectedElementIndex === null) return;
        const newElements = [...elements];
        newElements.splice(selectedElementIndex, 1);
        setElements(newElements);
        setSelectedElementIndex(null);
    };

    const onCIdChange = (value: string) => {
        if (selectedElementIndex === null) return;
        const newCId = parseInt(value, 10);
        const newElements = [...elements];
        newElements[selectedElementIndex] = {
            ...newElements[selectedElementIndex],
            cId: newCId
        };
        setElements(newElements);
    };

    const handleHintClick = async () => {
        if (selectedElementIndex === null) return;
        const currentHint = elements[selectedElementIndex].hint || "";
        const hint = await showInputModal({
            title: "Set Hint",
            message: "Enter a hint for this highlight:",
            placeholder: "Type a hint...",
            initialValue: currentHint
        });

        if (hint !== null) {
            const newElements = [...elements];
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                hint: hint || undefined
            };
            setElements(newElements);
        }
    };

    const handleExtraClick = async () => {
        if (selectedElementIndex === null) return;
        const extra = await showInputModal({
            title: "Set Extra",
            message: "Enter extra text for this highlight (shown on the back side):",
            placeholder: "Type extra text...",
            initialValue: elements[selectedElementIndex].extra || ""
        });

        if (extra !== null) {
            const newElements = [...elements];
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                extra: extra || undefined
            };
            setElements(newElements);
        }
    };

    useHighlightMaskKeyboard({
        open,
        modalId: modalContext?.modalId,
        selectedElementIndex,
        selectElement: setSelectedElementIndex,
        canUndo,
        canRedo,
        undo: undoElements,
        redo: redoElements,
        confirm: handleConfirm,
        cancel: handleCancel,
        deleteHighlight,
        changeClozeId: (value) => {
            setClozeId(value);
            onCIdChange(value);
        }
    });

    React.useEffect(() => {
        if (selectedElementIndex !== null) {
            setClozeId(elements[selectedElementIndex]?.cId.toString() || "1");
        }
    }, [selectedElementIndex, elements]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            hasCloseButton={false}
            size={"large"}>
            <div
                style={{
                    margin: "0rem",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "80vh"
                }}>
                <ModalHeader
                    title="Highlight Mask Editor"
                    icon={ANKI_ICON}
                    onClose={handleCancel}
                    showCloseButton={true}>
                    <a
                        href="https://github.com/sponsors/debanjandhar12"
                        target={"_blank"}
                        rel="noopener">
                        <img alt="Donate" style={{height: "1.4rem"}} src={DONATE_ICON} />
                    </a>
                </ModalHeader>

                <HighlightMaskToolbar
                    selected={selectedElementIndex !== null}
                    hint={
                        selectedElementIndex === null
                            ? undefined
                            : elements[selectedElementIndex]?.hint
                    }
                    clozeId={clozeId}
                    extra={
                        selectedElementIndex === null
                            ? undefined
                            : elements[selectedElementIndex]?.extra
                    }
                    hasTextSelection={hasTextSelection}
                    tags={tags}
                    setTags={setTags}
                    onClozeIdChange={(value) => {
                        setClozeId(value);
                        onCIdChange(value);
                    }}
                    onHint={handleHintClick}
                    onExtra={handleExtraClick}
                    onAdd={addHighlight}
                    onDelete={deleteHighlight}
                />

                <div
                    style={{
                        padding: "0.5rem 1rem",
                        borderBottom: "1px solid var(--ls-border-color)",
                        backgroundColor: "var(--ls-tertiary-background-color)"
                    }}>
                    <p className="text-sm opacity-80 m-0">
                        Select text in the editor below, then click "Add Highlight" to create a
                        cloze.
                    </p>
                </div>

                <div
                    className="overflow-y-auto"
                    style={{flex: 1, overflow: "auto", minHeight: 0, padding: "1rem"}}>
                    {/* The editor handles keyboard deselection; this wrapper also clears clicks in its padding. */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated editor selection, not a separate control */}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by useHighlightMaskKeyboard */}
                    <div
                        className="highlight-mask-content"
                        style={{userSelect: "text", lineHeight: "1.6"}}
                        onClick={(e) => {
                            // If user clicked inside the editor but not on a decoration, deselect
                            const target = e.target as HTMLElement;
                            if (!target.closest("[data-highlight-index]")) {
                                setSelectedElementIndex(null);
                            }
                        }}>
                        <div ref={editorRef} />
                    </div>
                </div>

                <DialogModalFooter
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmText="Save"
                    cancelText="Cancel"
                />
            </div>
        </Modal>
    );
};
