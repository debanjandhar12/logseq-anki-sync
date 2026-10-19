import React from "react";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {
    type AIChangesReviewChanges,
    AIChangesReviewModalComponent,
    type AIChangesReviewResult
} from "../pages/AIChangesReviewModal";

export async function showAIChangesReviewModal(
    changes: AIChangesReviewChanges
): Promise<AIChangesReviewResult> {
    return createModalPromise<AIChangesReviewResult>(
        (props) =>
            React.createElement(AIChangesReviewModalComponent, {
                ...changes,
                ...props
            }),
        {enableOutsideClickClose: true},
        {errorMessage: "Failed to open AI changes review modal"}
    );
}
