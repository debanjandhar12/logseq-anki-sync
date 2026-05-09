import {createModalPromise} from "../modals/utils/createModalPromise";
import {HighlightMaskEditorComponent} from "../pages/HighlightMaskEditor";
import React from "../React";

export type HighlightMaskElement = {
    cId: number;
    text: string;
    prefix: string;
    suffix: string;
    hint?: string;
};

export type HighlightMaskConfig = {
    // Reserved for future use
};

export type HighlightMaskData = {
    config: HighlightMaskConfig;
    elements: Array<HighlightMaskElement>;
    tags: string[];
};

export async function showHighlightMaskEditor(
    rawText: string,
    highlightElements: Array<HighlightMaskElement>,
    highlightConfig: HighlightMaskConfig,
    blockTags: string[] = []
): Promise<HighlightMaskData | boolean> {
    return createModalPromise<HighlightMaskData | boolean>(
        (props) =>
            React.createElement(HighlightMaskEditorComponent, {
                rawText,
                highlightElements,
                highlightConfig,
                blockTags,
                ...props
            }),
        {},
        {errorMessage: "Failed to open Highlight Mask Editor"}
    );
}
