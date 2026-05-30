import React from "react";
import type {InMemoryDB} from "src/core/logseq-fakeable-transaction-tracker/types";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {AIChangesReviewModalComponent} from "../pages/AIChangesReviewModal";

export async function showAIChangesReviewModal(
    currentPageDataDb: InMemoryDB,
    originalPageDataDb: InMemoryDB
): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) =>
            React.createElement(AIChangesReviewModalComponent, {
                currentPageDataDb,
                originalPageDataDb,
                ...props
            }),
        {enableOutsideClickClose: false},
        {errorMessage: "Failed to open AI changes review modal"}
    );
}
