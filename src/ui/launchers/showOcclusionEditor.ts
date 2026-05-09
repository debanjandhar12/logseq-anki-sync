import {createModalPromise} from "../modals/utils/createModalPromise";
import {OcclusionEditorComponent} from "../pages/OcclusionEditor";
import React from "../React";

export type OcclusionElement = {
    left: number;
    top: number;
    width: number;
    height: number;
    angle: number;
    cId: number;
    hint?: string;
};

export type OcclusionConfig = {
    // hideAllTestOne is now controlled via #hide-all-test-one tag
    // This type is kept for possible future user-defined config options
};

export type OcclusionData = {
    config: OcclusionConfig;
    elements: Array<OcclusionElement>;
    tags: string[];
};

export async function showOcclusionEditor(
    imgURL: string,
    occlusionElements: Array<OcclusionElement>,
    occlusionConfig: OcclusionConfig,
    blockTags: string[] = []
): Promise<OcclusionData | boolean> {
    return createModalPromise<OcclusionData | boolean>(
        (props) =>
            React.createElement(OcclusionEditorComponent, {
                imgURL,
                occlusionElements,
                occlusionConfig,
                blockTags,
                ...props
            }),
        {},
        {errorMessage: "Failed to open Occlusion Editor"}
    );
}
