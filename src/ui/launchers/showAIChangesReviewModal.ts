import React from "react";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {AIChangesReviewModalComponent} from "../pages/AIChangesReviewModal";

export async function showAIChangesReviewModal(
    beforeChanges: string,
    afterChanges: string
): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) =>
            React.createElement(AIChangesReviewModalComponent, {
                beforeChanges,
                afterChanges,
                ...props
            }),
        {enableOutsideClickClose: true},
        {errorMessage: "Failed to open AI changes review modal"}
    );
}
