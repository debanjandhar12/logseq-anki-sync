import {Editor, Extension} from "@tiptap/core";
import {Plugin, PluginKey} from "@tiptap/pm/state";
import {Decoration, DecorationSet} from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import _ from "lodash";
import HINT_ICON from "../../../node_modules/@tabler/icons/icons/outline/bulb.svg?raw";
import ADD_HIGHLIGHT_ICON from "../../../node_modules/@tabler/icons/icons/outline/plus.svg?raw";
import SETTINGS_ICON from "../../../node_modules/@tabler/icons/icons/outline/settings.svg?raw";
import REMOVE_HIGHLIGHT_ICON from "../../../node_modules/@tabler/icons/icons/outline/trash.svg?raw";
import {ANKI_ICON, DONATE_ICON} from "../../constants";
import {createLogger, LoggerCategory} from "../../logger";
import {WindowBridge} from "../../logseq/WindowBridge";
import {
    describeTextQuote,
    getHealedHighlightGeometry,
    matchTextQuote
} from "../../utils/HighlightNoteQuotePosFinder";
import {
    DialogModalFooter,
    Modal,
    ModalHeader,
    showConfirmModal,
    showInputModal,
    useModal
} from "../";
import {LogseqButton} from "../components/LogseqButton";
import {LogseqCheckbox} from "../components/LogseqCheckbox";
import {LogseqPopover} from "../components/LogseqPopover";
import {LogseqSelect} from "../components/LogseqSelect";
import {LogseqTooltip} from "../components/LogseqTooltip";
import useUndo from "../hooks/useUndo";
import type {
    HighlightMaskConfig,
    HighlightMaskData,
    HighlightMaskElement
} from "../launchers/showHighlightMaskEditor";
import React from "../React";
import {UI} from "../UI";

const logger = createLogger(LoggerCategory.UI);

const HighlightPluginKey = new PluginKey("highlightMask");

const HighlightMaskExtension = Extension.create({
    name: "highlightMask",

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: HighlightPluginKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, set) {
                        const meta = tr.getMeta(HighlightPluginKey);
                        if (meta && meta.type === "SET_DECORATIONS") {
                            return DecorationSet.create(tr.doc, meta.decorations);
                        }
                        return set.map(tr.mapping, tr.doc);
                    }
                },
                props: {
                    decorations(state) {
                        return HighlightPluginKey.getState(state);
                    }
                }
            })
        ];
    }
});

export const HighlightMaskEditorComponent: React.FC<{
    rawText: string;
    highlightElements: Array<HighlightMaskElement>;
    highlightConfig: HighlightMaskConfig;
    blockTags: string[];
    resolve: (value: HighlightMaskData | boolean) => void;
    reject: Function;
    modalContext?: {modalId: string | null};
}> = ({rawText, highlightElements, highlightConfig, blockTags, resolve, reject, modalContext}) => {
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
    const [hasTextSelection, setHasTextSelection] = React.useState(false);
    const [clozeId, setClozeId] = React.useState<string>("1");
    const cidSelectorRef = React.useRef<HTMLSelectElement>(null);
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [editor, setEditor] = React.useState<Editor | null>(null);

    // Initialize Editor
    React.useEffect(() => {
        if (!editorRef.current) return;

        const newEditor = new Editor({
            element: editorRef.current,
            extensions: [StarterKit, HighlightMaskExtension],
            content: `<pre><code>${_.escape(rawText)}</code></pre>`,
            editable: true,
            editorProps: {
                attributes: {
                    class: "prose prose-sm max-w-none focus:outline-none p-4 font-mono whitespace-pre-wrap"
                }
            },
            onTransaction: ({editor}) => {
                const {from, to} = editor.state.selection;
                setHasTextSelection(from !== to);
            }
        });

        setEditor(newEditor);

        return () => {
            newEditor.destroy();
        };
    }, []);

    React.useEffect(() => {
        if (!editor || !open) return;
        // Make it effectively read-only
        editor.setOptions({editable: false});
    }, [editor, open]);

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

    // Decoration Rendering
    React.useEffect(() => {
        if (!editor) return;

        let isCancelled = false;

        const renderDecorations = async () => {
            const decorations: Decoration[] = [];
            const fullText = editor.state.doc.textContent;

            for (let index = 0; index < elements.length; index++) {
                if (isCancelled) return;

                const el = elements[index];
                const isSelected = selectedElementIndex === index;
                const matchResult = await matchTextQuote(fullText, {
                    exact: el.text,
                    prefix: el.prefix,
                    suffix: el.suffix
                });

                if (matchResult) {
                    const actualStart = matchResult.start;
                    const actualEnd = matchResult.end;
                    // Map raw string index to ProseMirror positions...
                    let currentPos = 0;
                    let fromPos = -1;
                    let toPos = -1;

                    editor.state.doc.descendants((node, pos) => {
                        if (node.isText) {
                            const nodeText = node.text || "";
                            const nodeStart = currentPos;
                            const nodeEnd = currentPos + nodeText.length;

                            if (
                                fromPos === -1 &&
                                actualStart >= nodeStart &&
                                actualStart < nodeEnd
                            ) {
                                fromPos = pos + (actualStart - nodeStart);
                            }
                            if (toPos === -1 && actualEnd > nodeStart && actualEnd <= nodeEnd) {
                                toPos = pos + (actualEnd - nodeStart);
                            }
                            currentPos += nodeText.length;
                        } else if (node.isBlock && currentPos > 0) {
                            currentPos += 1;
                        }
                        if (fromPos !== -1 && toPos !== -1) return false;
                        return true;
                    });

                    if (fromPos !== -1 && toPos !== -1) {
                        const className = `cursor-pointer px-1 rounded transition-all ${
                            isSelected
                                ? "bg-blue-500 text-white ring-2 ring-blue-300"
                                : "bg-yellow-500 hover:bg-yellow-500"
                        }`;

                        const titleText = el.hint
                            ? `Cloze ID: ${el.cId} | Hint: ${el.hint}`
                            : `Cloze ID: ${el.cId}`;
                        decorations.push(
                            Decoration.inline(fromPos, toPos, {
                                class: className,
                                title: titleText,
                                "data-highlight-index": String(index)
                            })
                        );

                        const badge = document.createElement("span");
                        badge.className = "mr-1 text-xs font-bold opacity-30 user-select-none";
                        badge.innerText = `c${el.cId}`;
                        badge.contentEditable = "false";
                        decorations.push(Decoration.widget(fromPos, badge));
                    }
                }
            }

            if (!isCancelled) {
                editor.view.dispatch(
                    editor.state.tr.setMeta(HighlightPluginKey, {
                        type: "SET_DECORATIONS",
                        decorations: decorations
                    })
                );
            }
        };

        renderDecorations();
        return () => {
            isCancelled = true;
        };
    }, [elements, selectedElementIndex, editor]);

    // Handle Editor clicks
    React.useEffect(() => {
        if (!editor?.view.dom) return;
        const dom = editor.view.dom;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const highlightIndex = target.getAttribute("data-highlight-index");
            if (highlightIndex !== null) {
                setSelectedElementIndex(parseInt(highlightIndex, 10));
                editor.commands.setTextSelection(0);
                e.stopPropagation();
            } else {
                setSelectedElementIndex(null);
            }
        };
        dom.addEventListener("click", handleClick);
        return () => dom.removeEventListener("click", handleClick);
    }, [editor]);

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
        // Map PM positions back to raw text string index to get accurate prefix/suffix
        let currentPos = 0;
        let actualStart = -1;
        let actualEnd = -1;
        editor.state.doc.descendants((node, pos) => {
            if (node.isText) {
                const nodeLen = node.text?.length || 0;
                if (actualStart === -1 && from <= pos + nodeLen) {
                    actualStart = currentPos + Math.max(0, from - pos);
                }
                if (to >= pos) {
                    actualEnd = currentPos + Math.min(nodeLen, Math.max(0, to - pos));
                }
                currentPos += nodeLen;
            } else if (node.isBlock && currentPos > 0) {
                currentPos += 1;
            }
        });

        if (actualStart === -1) actualStart = 0;
        if (actualEnd === -1) actualEnd = currentPos;

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

    React.useEffect(() => {
        if (!open) return;
        const onKeydown = (e: Event) => {
            const keyboardEvent = e as KeyboardEvent;
            if (UI.getActiveModal() !== modalContext?.modalId) return;

            if (keyboardEvent.key === "Escape") {
                if (selectedElementIndex !== null) {
                    setSelectedElementIndex(null);
                    keyboardEvent.preventDefault();
                    keyboardEvent.stopImmediatePropagation();
                    return;
                } else {
                    handleCancel();
                    keyboardEvent.preventDefault();
                    keyboardEvent.stopImmediatePropagation();
                    return;
                }
            }

            // Ctrl+Z - Undo
            if (keyboardEvent.ctrlKey && keyboardEvent.key === "z" && !keyboardEvent.shiftKey) {
                if (canUndo) {
                    undoElements();
                }
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                return;
            }

            // Ctrl+Shift+Z - Redo
            if (keyboardEvent.ctrlKey && keyboardEvent.key === "Z" && keyboardEvent.shiftKey) {
                if (canRedo) {
                    redoElements();
                }
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                return;
            }

            if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
                handleConfirm();
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                return;
            }

            if (keyboardEvent.key === "Delete" && selectedElementIndex !== null) {
                deleteHighlight();
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                return;
            }

            if (
                keyboardEvent.key >= "1" &&
                keyboardEvent.key <= "9" &&
                selectedElementIndex !== null
            ) {
                const newClozeId = keyboardEvent.key;
                setClozeId(newClozeId);
                onCIdChange(newClozeId);
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                return;
            }
        };

        WindowBridge.addDocumentEventListener("keydown", onKeydown, {capture: true});
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown, {capture: true});
        };
    }, [open, selectedElementIndex, elements, modalContext?.modalId, canUndo, canRedo]);

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

                <div
                    style={{
                        borderBottom: "1px solid var(--ls-border-color)",
                        alignItems: "center",
                        justifyContent: "end",
                        flexShrink: 0
                    }}
                    className="highlight-mask-editor-toolbar flex">
                    <span
                        className={selectedElementIndex !== null ? "flex" : "hidden"}
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)"
                        }}>
                        <LogseqSelect
                            ref={cidSelectorRef}
                            value={clozeId}
                            onChange={(val) => {
                                setClozeId(val);
                                onCIdChange(val);
                            }}
                            options={_.range(1, 10).map((i) => ({value: i, label: String(i)}))}
                            title="Cloze Id:"
                            size="sm"
                            width="80px"
                        />
                        {selectedElementIndex !== null && (
                            <LogseqButton
                                color={
                                    elements[selectedElementIndex]?.hint ? "primary" : "secondary"
                                }
                                size={"sm"}
                                title={
                                    elements[selectedElementIndex]?.hint
                                        ? `Hint: ${elements[selectedElementIndex].hint}`
                                        : "Set Hint"
                                }
                                onClick={handleHintClick}
                                icon={HINT_ICON}
                            />
                        )}
                    </span>

                    <span
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)"
                        }}>
                        <LogseqPopover
                            placement="bottom-end"
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
                                        width: "240px"
                                    }}>
                                    <LogseqCheckbox
                                        checked={tags.includes("hide-all-test-one")}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setTags([...tags, "hide-all-test-one"]);
                                            } else {
                                                setTags(
                                                    tags.filter((t) => t !== "hide-all-test-one")
                                                );
                                            }
                                        }}>
                                        Hide All, Test One (
                                        <LogseqTooltip content="When enabled, hides all highlights including the one being tested during anki review.">
                                            ?
                                        </LogseqTooltip>
                                        )
                                    </LogseqCheckbox>
                                </div>
                            }>
                            <LogseqButton color={"default"} size={"sm"} icon={SETTINGS_ICON} />
                        </LogseqPopover>
                    </span>

                    <span style={{paddingLeft: "0.5rem"}} />
                    <LogseqButton
                        color={"success"}
                        size={"sm"}
                        isFullWidth={false}
                        title={"Add Highlight (Select text first)"}
                        onClick={addHighlight}
                        icon={ADD_HIGHLIGHT_ICON}
                        disabled={!hasTextSelection || selectedElementIndex !== null}
                    />
                    <LogseqButton
                        color={"failed"}
                        size={"sm"}
                        isFullWidth={false}
                        title={"Delete Highlight"}
                        onClick={deleteHighlight}
                        icon={REMOVE_HIGHLIGHT_ICON}
                        disabled={selectedElementIndex === null}
                    />
                </div>

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
                    <div
                        className="highlight-mask-content"
                        style={{userSelect: "text", lineHeight: "1.6"}}
                        onClick={(e) => {
                            // If user clicked inside the editor but not on a decoration, deselect
                            const target = e.target as HTMLElement;
                            if (!target.hasAttribute("data-highlight-index")) {
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
