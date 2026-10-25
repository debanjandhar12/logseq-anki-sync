import type {Editor} from "@tiptap/core";
import {Decoration} from "@tiptap/pm/view";
import {useEffect} from "react";
import {matchTextQuote} from "../../../utils/HighlightNoteQuotePosFinder";
import type {HighlightMaskElement} from "../../launchers/showHighlightMaskEditor";
import {HighlightPluginKey} from "./HighlightMaskExtension";
import {textRangeToEditorRange} from "./utils/textRangeToEditorRange";

export function useHighlightDecorations(
    editor: Editor | null,
    elements: HighlightMaskElement[],
    selectedElementIndex: number | null
) {
    useEffect(() => {
        if (!editor) return;
        let isCancelled = false;
        const renderDecorations = async () => {
            const decorations: Decoration[] = [];
            const fullText = editor.state.doc.textContent;
            for (let index = 0; index < elements.length; index++) {
                if (isCancelled) return;
                const el = elements[index];
                const match = await matchTextQuote(fullText, {
                    exact: el.text,
                    prefix: el.prefix,
                    suffix: el.suffix
                });
                if (!match) continue;
                const {from, to} = textRangeToEditorRange(editor.state.doc, match.start, match.end);
                if (from === -1 || to === -1) continue;
                const selected = selectedElementIndex === index;
                const title = el.hint
                    ? `Cloze ID: ${el.cId} | Hint: ${el.hint}`
                    : `Cloze ID: ${el.cId}`;
                decorations.push(
                    Decoration.inline(from, to, {
                        class: `highlight-mask-text ${selected ? "bg-blue-500 text-white" : "bg-yellow-500"}`,
                        title,
                        "data-highlight-selected": String(selected),
                        "data-highlight-index": String(index)
                    })
                );
                const badge = document.createElement("span");
                badge.className = `highlight-mask-badge ${selected ? "bg-blue-500 text-white" : "bg-secondary-background text-text"}`;
                const label = document.createElement("span");
                label.className = "highlight-mask-badge-label";
                label.textContent = `c${el.cId}`;
                badge.append(label);
                badge.dataset.highlightIndex = String(index);
                badge.dataset.highlightSelected = String(selected);
                badge.title = title;
                badge.contentEditable = "false";
                decorations.push(Decoration.widget(from, badge));
            }
            if (!isCancelled)
                editor.view.dispatch(
                    editor.state.tr.setMeta(HighlightPluginKey, {
                        type: "SET_DECORATIONS",
                        decorations
                    })
                );
        };
        void renderDecorations();
        return () => {
            isCancelled = true;
        };
    }, [editor, elements, selectedElementIndex]);
}
