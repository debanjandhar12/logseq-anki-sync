import {EditorView} from "@codemirror/view";
import type {Locator} from "vitest/browser";

export function getCodeMirrorView(content: Locator): EditorView {
    const view = EditorView.findFromDOM(content.element() as HTMLElement);
    if (!view) throw new Error("CodeMirror has not mounted");
    return view;
}
