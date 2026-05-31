import React from "react";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {SkillEditorModalComponent} from "../pages/SkillEditorModal";

export async function showSkillEditorModal(): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) =>
            React.createElement(SkillEditorModalComponent, {
                ...props
            }),
        {},
        {errorMessage: "Failed to open skill editor modal"}
    );
}
