import React from "react";
import type {LogseqPrintedPageChange} from "src/core/logseq-reversible-transaction-tracker";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {AIChangesReviewModalComponent} from "../pages/AIChangesReviewModal";

export async function showAIChangesReviewModal(
    changes: LogseqPrintedPageChange[]
): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) =>
            React.createElement(AIChangesReviewModalComponent, {
                changes,
                ...props
            }),
        {enableOutsideClickClose: true},
        {errorMessage: "Failed to open AI changes review modal"}
    );
}
