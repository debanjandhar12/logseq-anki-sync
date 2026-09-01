import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import type {CommandInvokeLocation} from "src/core/stores/command-file-store/types";
import {getCategoryCheckState, InvokeLocationTreePopover} from "src/ui/pages/CommandEditorModal";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

describe("getCategoryCheckState", () => {
    const children = [
        "Block Context Menu/Image",
        "Block Context Menu/Pdf"
    ] as const satisfies readonly CommandInvokeLocation[];

    test("derives checked and indeterminate category states", () => {
        expect(getCategoryCheckState(new Set(), children)).toEqual({
            checked: false,
            indeterminate: false
        });
        expect(getCategoryCheckState(new Set([children[0]]), children)).toEqual({
            checked: false,
            indeterminate: true
        });
        expect(getCategoryCheckState(new Set(children), children)).toEqual({
            checked: true,
            indeterminate: false
        });
    });
});

describe("InvokeLocationTreePopover", () => {
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
        vi.restoreAllMocks();
    });

    test("selects every child when a category is toggled", async () => {
        const onValueChange = vi.fn();
        await act(async () => {
            root.render(React.createElement(InvokeLocationTreePopover, {value: [], onValueChange}));
        });

        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Choose command invocation locations"]'
        );
        await act(async () => trigger?.click());
        const blockCategory = Array.from(container.querySelectorAll("label")).find((label) =>
            label.textContent?.includes("Block Context Menu")
        );
        await act(async () => blockCategory?.querySelector("input")?.click());

        expect(onValueChange).toHaveBeenCalledWith([
            "Block Context Menu/Image",
            "Block Context Menu/Pdf",
            "Block Context Menu/Video",
            "Block Context Menu/Flashcard",
            "Block Context Menu/Other Blocks"
        ]);
    });

    test("keeps built-in locations read-only", async () => {
        const onValueChange = vi.fn();
        await act(async () => {
            root.render(
                React.createElement(InvokeLocationTreePopover, {
                    value: ["Block Context Menu/Image"],
                    readOnly: true,
                    onValueChange
                })
            );
        });
        await act(async () => {
            container
                .querySelector<HTMLButtonElement>(
                    'button[aria-label="Choose command invocation locations"]'
                )
                ?.click();
        });

        expect(
            Array.from(container.querySelectorAll("input")).every((input) => input.disabled)
        ).toBe(true);
        expect(onValueChange).not.toHaveBeenCalled();
    });
});
