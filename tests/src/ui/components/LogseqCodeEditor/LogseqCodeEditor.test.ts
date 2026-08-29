import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

const {codeMirrorProps} = vi.hoisted(() => ({codeMirrorProps: vi.fn()}));

vi.mock("@uiw/react-codemirror", () => ({
    default: (props: Record<string, unknown>) => {
        codeMirrorProps(props);
        return React.createElement("div", {"data-testid": "code-mirror"});
    }
}));

import {LogseqCodeEditor} from "src/ui/components/LogseqCodeEditor";

describe("LogseqCodeEditor", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        codeMirrorProps.mockReset();
    });

    test("enables CodeMirror read-only state whenever editing is disabled", () => {
        act(() => {
            root.render(
                React.createElement(LogseqCodeEditor, {value: "Built in", editable: false})
            );
        });

        expect(codeMirrorProps).toHaveBeenLastCalledWith(
            expect.objectContaining({editable: false, readOnly: true})
        );
    });

    test("preserves an explicitly read-only editable surface", () => {
        act(() => {
            root.render(React.createElement(LogseqCodeEditor, {value: "Preview", readOnly: true}));
        });

        expect(codeMirrorProps).toHaveBeenLastCalledWith(
            expect.objectContaining({editable: undefined, readOnly: true})
        );
    });
});
