import {Editor} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {escape as escapeHtml} from "lodash";
import {useEffect, useRef, useState} from "react";
import {HighlightMaskExtension} from "./HighlightMaskExtension";

export function useHighlightMaskEditor(
    rawText: string,
    open: boolean,
    onHighlightSelect: (index: number | null) => void
) {
    const editorRef = useRef<HTMLDivElement>(null);
    const initialText = useRef(rawText);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [hasTextSelection, setHasTextSelection] = useState(false);
    useEffect(() => {
        if (!editorRef.current) return;
        const instance = new Editor({
            element: editorRef.current,
            extensions: [StarterKit, HighlightMaskExtension],
            content: `<pre><code>${escapeHtml(initialText.current)}</code></pre>`,
            editable: true,
            editorProps: {
                attributes: {
                    class: "prose prose-sm max-w-none focus:outline-hidden p-4 font-mono whitespace-pre-wrap"
                }
            },
            onTransaction: ({editor}) => {
                const {from, to} = editor.state.selection;
                setHasTextSelection(from !== to);
            }
        });
        setEditor(instance);
        return () => instance.destroy();
    }, []);
    useEffect(() => {
        if (editor && open) editor.setOptions({editable: false});
    }, [editor, open]);
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom;
        const handleClick = (event: MouseEvent) => {
            const index =
                (event.target as HTMLElement)
                    .closest("[data-highlight-index]")
                    ?.getAttribute("data-highlight-index") ?? null;
            onHighlightSelect(index === null ? null : parseInt(index, 10));
            if (index !== null) {
                editor.commands.setTextSelection(0);
                event.stopPropagation();
            }
        };
        dom.addEventListener("click", handleClick);
        return () => dom.removeEventListener("click", handleClick);
    }, [editor, onHighlightSelect]);
    return {editor, editorRef, hasTextSelection};
}
