import React from "react";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {CommandEditorModalComponent} from "../pages/CommandEditorModal";

export async function showCommandEditorModal(): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) => React.createElement(CommandEditorModalComponent, props),
        {},
        {errorMessage: "Failed to open command editor modal"}
    );
}
