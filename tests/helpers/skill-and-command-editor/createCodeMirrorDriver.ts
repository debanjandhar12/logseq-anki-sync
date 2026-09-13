import type {EditorView} from "@codemirror/view";
import {expect} from "vitest";
import {type Locator, page} from "vitest/browser";
import {getCodeMirrorView} from "../query/getCodeMirrorView";

export function createCodeMirrorDriver(content: Locator) {
    return {
        content,
        view(): EditorView {
            return getCodeMirrorView(content);
        },
        text(): string {
            return getCodeMirrorView(content).state.doc.toString();
        },
        // Use CodeMirror's public API for precise selection, then edit through browser input.
        async placeCursor(position: number): Promise<void> {
            const view = getCodeMirrorView(content);
            view.dispatch({selection: {anchor: position}, scrollIntoView: true});
            view.focus();
            await expect.poll(() => view.state.selection.main.head).toBe(position);
        },
        completionOption(label: string): Locator {
            return page.getByRole("option", {name: label, exact: true});
        },
        completionListbox: page.getByRole("listbox")
    };
}

export type CodeMirrorDriver = ReturnType<typeof createCodeMirrorDriver>;
