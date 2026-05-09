import {createModalPromise} from "../modals/utils/createModalPromise";
import {LogseqAnkiFeatureExplorerComponent} from "../pages/LogseqAnkiFeatureExplorer";
import React from "../React";

export async function showLogseqAnkiFeatureExplorer(editingBlockUUID: string): Promise<void> {
    return createModalPromise<void>(
        (props) =>
            React.createElement(LogseqAnkiFeatureExplorerComponent, {
                editingBlockUUID,
                ...props
            }),
        {},
        {errorMessage: "Failed to open Logseq Anki Feature Explorer"}
    );
}
